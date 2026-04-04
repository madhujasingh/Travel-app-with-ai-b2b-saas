package com.itinera.service;

import com.itinera.exception.ResourceNotFoundException;
import com.itinera.model.Activity;
import com.itinera.model.DayPlan;
import com.itinera.model.GroupTrip;
import com.itinera.model.GroupTripMember;
import com.itinera.model.GroupTripOption;
import com.itinera.model.GroupTripVote;
import com.itinera.model.Itinerary;
import com.itinera.model.User;
import com.itinera.repository.GroupTripMemberRepository;
import com.itinera.repository.GroupTripOptionRepository;
import com.itinera.repository.GroupTripRepository;
import com.itinera.repository.GroupTripVoteRepository;
import com.itinera.repository.ItineraryRepository;
import com.itinera.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class GroupTripService {
    private final GroupTripRepository groupTripRepository;
    private final GroupTripMemberRepository groupTripMemberRepository;
    private final GroupTripOptionRepository groupTripOptionRepository;
    private final GroupTripVoteRepository groupTripVoteRepository;
    private final ItineraryRepository itineraryRepository;
    private final UserRepository userRepository;

    public GroupTripService(
            GroupTripRepository groupTripRepository,
            GroupTripMemberRepository groupTripMemberRepository,
            GroupTripOptionRepository groupTripOptionRepository,
            GroupTripVoteRepository groupTripVoteRepository,
            ItineraryRepository itineraryRepository,
            UserRepository userRepository
    ) {
        this.groupTripRepository = groupTripRepository;
        this.groupTripMemberRepository = groupTripMemberRepository;
        this.groupTripOptionRepository = groupTripOptionRepository;
        this.groupTripVoteRepository = groupTripVoteRepository;
        this.itineraryRepository = itineraryRepository;
        this.userRepository = userRepository;
    }

    public List<GroupTripSummaryResponse> getMyTrips(Long userId) {
        return groupTripMemberRepository.findByUserIdOrderByJoinedAtDesc(userId)
                .stream()
                .map(GroupTripMember::getGroupTrip)
                .distinct()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    public GroupTripDetailResponse createTrip(Long userId, CreateGroupTripRequest request) {
        User creator = getUser(userId);

        GroupTrip trip = new GroupTrip();
        trip.setTitle(request.title().trim());
        trip.setDestination(request.destination().trim());
        trip.setDescription(request.description() == null ? null : request.description().trim());
        trip.setCreatedByUserId(userId);
        trip.setInviteCode(generateInviteCode());
        trip.setStatus("PLANNING");
        GroupTrip savedTrip = groupTripRepository.save(trip);

        GroupTripMember member = new GroupTripMember();
        member.setGroupTrip(savedTrip);
        member.setUserId(userId);
        member.setUserName(creator.getName());
        groupTripMemberRepository.save(member);

        return getTrip(savedTrip.getId(), userId);
    }

    public GroupTripDetailResponse joinTrip(Long userId, JoinGroupTripRequest request) {
        GroupTrip trip = groupTripRepository.findByInviteCodeIgnoreCase(request.inviteCode().trim())
                .orElseThrow(() -> new ResourceNotFoundException("Group trip invite code not found"));

        if (!groupTripMemberRepository.existsByGroupTripIdAndUserId(trip.getId(), userId)) {
            User user = getUser(userId);
            GroupTripMember member = new GroupTripMember();
            member.setGroupTrip(trip);
            member.setUserId(userId);
            member.setUserName(user.getName());
            groupTripMemberRepository.save(member);
        }

        return getTrip(trip.getId(), userId);
    }

    public GroupTripDetailResponse getTrip(Long tripId, Long userId) {
        GroupTrip trip = getTripEntity(tripId);
        requireMembership(tripId, userId);

        List<GroupTripMember> members = groupTripMemberRepository.findByGroupTripIdOrderByJoinedAtAsc(tripId);
        List<GroupTripOption> options = groupTripOptionRepository.findByGroupTripIdOrderByLockedWinnerDescScoreDescCreatedAtAsc(tripId);

        Map<String, List<GroupTripOptionResponse>> optionsByCategory = new LinkedHashMap<>();
        for (GroupTripOption.OptionCategory category : GroupTripOption.OptionCategory.values()) {
            List<GroupTripOptionResponse> categoryOptions = options.stream()
                    .filter(option -> option.getCategory() == category)
                    .sorted(Comparator.comparing(GroupTripOption::getLockedWinner).reversed()
                            .thenComparing(GroupTripOption::getScore, Comparator.reverseOrder())
                            .thenComparing(GroupTripOption::getCreatedAt))
                    .map(option -> toOptionResponse(option, userId))
                    .collect(Collectors.toList());
            optionsByCategory.put(category.name(), categoryOptions);
        }

        List<GroupTripOptionResponse> winners = optionsByCategory.values()
                .stream()
                .map(this::pickWinner)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toList());

        return new GroupTripDetailResponse(
                trip.getId(),
                trip.getTitle(),
                trip.getDestination(),
                trip.getDescription(),
                trip.getInviteCode(),
                trip.getStatus(),
                trip.getCreatedByUserId().equals(userId),
                members.stream()
                        .map(member -> new GroupTripMemberResponse(
                                member.getId(),
                                member.getUserId(),
                                member.getUserName(),
                                member.getJoinedAt() == null ? null : member.getJoinedAt().toString()
                        ))
                        .collect(Collectors.toList()),
                optionsByCategory,
                winners,
                toLinkedItineraryResponse(trip.getFinalizedItineraryId())
        );
    }

    public GroupTripOptionResponse addOption(Long tripId, Long userId, AddGroupTripOptionRequest request) {
        GroupTrip trip = getTripEntity(tripId);
        User user = getUser(userId);
        requireMembership(tripId, userId);

        GroupTripOption option = new GroupTripOption();
        option.setGroupTrip(trip);
        option.setCategory(GroupTripOption.OptionCategory.valueOf(request.category().trim().toUpperCase()));
        option.setTitle(request.title().trim());
        option.setDescription(request.description() == null ? null : request.description().trim());
        option.setLocation(request.location() == null ? null : request.location().trim());
        option.setAddedByUserId(userId);
        option.setAddedByName(user.getName());
        option.setScore(0);
        option.setLockedWinner(false);
        GroupTripOption saved = groupTripOptionRepository.save(option);

        return toOptionResponse(saved, userId);
    }

    public GroupTripOptionResponse voteOnOption(Long tripId, Long optionId, Long userId, VoteRequest request) {
        requireMembership(tripId, userId);
        User user = getUser(userId);
        GroupTripOption option = getOption(optionId, tripId);

        int voteValue = request.voteValue();
        if (voteValue != 1 && voteValue != -1) {
            throw new IllegalArgumentException("voteValue must be 1 or -1");
        }

        Optional<GroupTripVote> existingVote = groupTripVoteRepository.findByOptionIdAndUserId(optionId, userId);
        if (existingVote.isPresent()) {
            GroupTripVote vote = existingVote.get();
            vote.setVoteValue(voteValue);
            vote.setUserName(user.getName());
            groupTripVoteRepository.save(vote);
        } else {
            GroupTripVote vote = new GroupTripVote();
            vote.setOption(option);
            vote.setUserId(userId);
            vote.setUserName(user.getName());
            vote.setVoteValue(voteValue);
            groupTripVoteRepository.save(vote);
        }

        option.setScore(recalculateScore(optionId));
        GroupTripOption saved = groupTripOptionRepository.save(option);
        return toOptionResponse(saved, userId);
    }

    public GroupTripDetailResponse lockWinner(Long tripId, Long optionId, Long userId) {
        GroupTrip trip = getTripEntity(tripId);
        requireOrganizer(trip, userId);
        GroupTripOption winner = getOption(optionId, tripId);

        List<GroupTripOption> sameCategoryOptions =
                groupTripOptionRepository.findByGroupTripIdAndCategoryOrderByLockedWinnerDescScoreDescCreatedAtAsc(
                        tripId,
                        winner.getCategory()
                );

        for (GroupTripOption option : sameCategoryOptions) {
            option.setLockedWinner(option.getId().equals(optionId));
        }
        groupTripOptionRepository.saveAll(sameCategoryOptions);

        return getTrip(tripId, userId);
    }

    public GroupTripDetailResponse finalizeTrip(Long tripId, Long userId) {
        GroupTrip trip = getTripEntity(tripId);
        requireOrganizer(trip, userId);

        List<GroupTripOption> options = groupTripOptionRepository.findByGroupTripIdOrderByLockedWinnerDescScoreDescCreatedAtAsc(tripId);
        Map<GroupTripOption.OptionCategory, GroupTripOption> winners = pickWinningOptions(options);
        if (winners.isEmpty()) {
            throw new IllegalArgumentException("Add and vote on at least one option before generating an itinerary");
        }

        Itinerary itinerary = trip.getFinalizedItineraryId() == null
                ? new Itinerary()
                : itineraryRepository.findById(trip.getFinalizedItineraryId()).orElseGet(Itinerary::new);

        populateItineraryFromGroupTrip(itinerary, trip, winners);
        Itinerary savedItinerary = itineraryRepository.save(itinerary);

        trip.setFinalizedItineraryId(savedItinerary.getId());
        trip.setStatus("ITINERARY_READY");
        groupTripRepository.save(trip);

        return getTrip(tripId, userId);
    }

    private GroupTrip getTripEntity(Long tripId) {
        return groupTripRepository.findById(tripId)
                .orElseThrow(() -> new ResourceNotFoundException("Group trip", "id", tripId));
    }

    private GroupTripOption getOption(Long optionId, Long tripId) {
        GroupTripOption option = groupTripOptionRepository.findById(optionId)
                .orElseThrow(() -> new ResourceNotFoundException("Group trip option", "id", optionId));
        if (!option.getGroupTrip().getId().equals(tripId)) {
            throw new IllegalArgumentException("Option does not belong to this trip");
        }
        return option;
    }

    private void requireMembership(Long tripId, Long userId) {
        if (!groupTripMemberRepository.existsByGroupTripIdAndUserId(tripId, userId)) {
            throw new AccessDeniedException("You must join this group trip first");
        }
    }

    private void requireOrganizer(GroupTrip trip, Long userId) {
        if (!trip.getCreatedByUserId().equals(userId)) {
            throw new AccessDeniedException("Only the trip organizer can manage winners");
        }
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
    }

    private String generateInviteCode() {
        String code;
        do {
            code = UUID.randomUUID().toString().replace("-", "").substring(0, 6).toUpperCase();
        } while (groupTripRepository.existsByInviteCodeIgnoreCase(code));
        return code;
    }

    private Integer recalculateScore(Long optionId) {
        return groupTripVoteRepository.findByOptionId(optionId)
                .stream()
                .map(GroupTripVote::getVoteValue)
                .reduce(0, Integer::sum);
    }

    private Map<GroupTripOption.OptionCategory, GroupTripOption> pickWinningOptions(List<GroupTripOption> options) {
        Map<GroupTripOption.OptionCategory, GroupTripOption> winners = new LinkedHashMap<>();

        for (GroupTripOption.OptionCategory category : GroupTripOption.OptionCategory.values()) {
            options.stream()
                    .filter(option -> option.getCategory() == category)
                    .sorted(Comparator.comparing(GroupTripOption::getLockedWinner).reversed()
                            .thenComparing(GroupTripOption::getScore, Comparator.reverseOrder())
                            .thenComparing(GroupTripOption::getCreatedAt))
                    .findFirst()
                    .ifPresent(option -> winners.put(category, option));
        }

        return winners;
    }

    private void populateItineraryFromGroupTrip(
            Itinerary itinerary,
            GroupTrip trip,
            Map<GroupTripOption.OptionCategory, GroupTripOption> winners
    ) {
        GroupTripOption stay = winners.get(GroupTripOption.OptionCategory.LODGING);
        GroupTripOption activity = winners.get(GroupTripOption.OptionCategory.ACTIVITY);
        GroupTripOption restaurant = winners.get(GroupTripOption.OptionCategory.RESTAURANT);

        itinerary.setTitle(trip.getTitle() + " Group Itinerary");
        itinerary.setDestination(trip.getDestination());
        itinerary.setDuration(resolveDuration(winners.size()));
        itinerary.setPrice(BigDecimal.valueOf(estimatePrice(winners.size())));
        itinerary.setRating(5);
        itinerary.setReviewCount(0);
        itinerary.setDescription(buildDescription(trip, stay, activity, restaurant));
        itinerary.setImageUrl(null);
        itinerary.setType(resolveType(activity, stay));
        itinerary.setCategory(resolveCategory(trip.getDestination()));
        itinerary.setIsActive(true);
        itinerary.setUpdatedAt(LocalDateTime.now());
        itinerary.setHighlights(buildHighlights(winners));
        itinerary.setInclusions(buildInclusions(stay, activity, restaurant));
        itinerary.setExclusions(List.of("Flights", "Personal expenses", "Anything not selected by the group"));
        itinerary.setDayPlans(buildDayPlans(itinerary, trip, stay, activity, restaurant));
    }

    private String resolveDuration(int winnerCount) {
        int days = Math.max(3, winnerCount + 1);
        return days + " Days / " + Math.max(2, days - 1) + " Nights";
    }

    private long estimatePrice(int winnerCount) {
        return 18000L + (winnerCount * 4500L);
    }

    private String buildDescription(
            GroupTrip trip,
            GroupTripOption stay,
            GroupTripOption activity,
            GroupTripOption restaurant
    ) {
        List<String> sections = new ArrayList<>();
        sections.add("Auto-generated from your group's highest-ranked picks for " + trip.getDestination() + ".");

        if (stay != null) {
            sections.add("Stay shortlist winner: " + stay.getTitle() + ".");
        }
        if (activity != null) {
            sections.add("Core experience: " + activity.getTitle() + ".");
        }
        if (restaurant != null) {
            sections.add("Dining pick: " + restaurant.getTitle() + ".");
        }
        if (trip.getDescription() != null && !trip.getDescription().isBlank()) {
            sections.add("Group notes: " + trip.getDescription());
        }

        return String.join(" ", sections);
    }

    private Itinerary.ItineraryType resolveType(GroupTripOption activity, GroupTripOption stay) {
        String source = ((activity == null ? "" : activity.getTitle()) + " " + (stay == null ? "" : stay.getTitle())).toLowerCase();
        if (source.contains("adventure") || source.contains("trek") || source.contains("raft")) {
            return Itinerary.ItineraryType.ADVENTURE;
        }
        if (source.contains("romantic") || source.contains("honeymoon")) {
            return Itinerary.ItineraryType.ROMANTIC;
        }
        if (source.contains("luxury") || source.contains("resort") || source.contains("villa")) {
            return Itinerary.ItineraryType.PREMIUM;
        }
        if (source.contains("family")) {
            return Itinerary.ItineraryType.FAMILY;
        }
        return Itinerary.ItineraryType.PREMIUM;
    }

    private Itinerary.Category resolveCategory(String destination) {
        List<String> internationalKeywords = Arrays.asList(
                "paris", "tokyo", "dubai", "bali", "maldives", "switzerland", "singapore", "thailand", "phuket", "krabi"
        );
        String lower = destination == null ? "" : destination.toLowerCase();
        return internationalKeywords.stream().anyMatch(lower::contains)
                ? Itinerary.Category.INTERNATIONAL
                : Itinerary.Category.INDIA;
    }

    private List<String> buildHighlights(Map<GroupTripOption.OptionCategory, GroupTripOption> winners) {
        return winners.values().stream()
                .map(GroupTripOption::getTitle)
                .limit(4)
                .collect(Collectors.toList());
    }

    private List<String> buildInclusions(
            GroupTripOption stay,
            GroupTripOption activity,
            GroupTripOption restaurant
    ) {
        List<String> inclusions = new ArrayList<>();
        if (stay != null) {
            inclusions.add("Stay at " + stay.getTitle());
        }
        if (activity != null) {
            inclusions.add("Experience access for " + activity.getTitle());
        }
        if (restaurant != null) {
            inclusions.add("Dining plan featuring " + restaurant.getTitle());
        }
        inclusions.add("Group-coordinated itinerary draft");
        return inclusions;
    }

    private List<DayPlan> buildDayPlans(
            Itinerary itinerary,
            GroupTrip trip,
            GroupTripOption stay,
            GroupTripOption activity,
            GroupTripOption restaurant
    ) {
        List<DayPlan> dayPlans = new ArrayList<>();

        dayPlans.add(createDayPlan(
                itinerary,
                1,
                "Arrival and group check-in",
                List.of(
                        createActivity("Morning", "Arrive in " + trip.getDestination(), "airplane-outline"),
                        createActivity("Afternoon", stay == null ? "Check into selected stay" : "Check into " + stay.getTitle(), "bed-outline"),
                        createActivity("Evening", "Settle in and review the group-picked plan", "people-outline")
                )
        ));

        if (activity != null) {
            dayPlans.add(createDayPlan(
                    itinerary,
                    2,
                    "Group experience day",
                    List.of(
                            createActivity("Morning", "Head out for " + activity.getTitle(), "trail-sign-outline"),
                            createActivity("Afternoon", activity.getDescription() == null || activity.getDescription().isBlank()
                                    ? "Enjoy the group's top-voted activity"
                                    : activity.getDescription(), "sparkles-outline"),
                            createActivity("Evening", restaurant == null
                                    ? "Free evening for the group"
                                    : "Dinner at " + restaurant.getTitle(), "restaurant-outline")
                    )
            ));
        }

        if (restaurant != null || stay != null) {
            dayPlans.add(createDayPlan(
                    itinerary,
                    dayPlans.size() + 1,
                    "Wind down and wrap up",
                    List.of(
                            createActivity("Morning", stay == null ? "Leisure morning" : "Enjoy amenities at " + stay.getTitle(), "cafe-outline"),
                            createActivity("Afternoon", restaurant == null ? "Explore at your own pace" : "Final meal at " + restaurant.getTitle(), "restaurant-outline"),
                            createActivity("Evening", "Departure or onward travel", "car-outline")
                    )
            ));
        }

        return dayPlans;
    }

    private DayPlan createDayPlan(Itinerary itinerary, int dayNumber, String title, List<Activity> activities) {
        DayPlan dayPlan = new DayPlan();
        dayPlan.setItinerary(itinerary);
        dayPlan.setDayNumber(dayNumber);
        dayPlan.setTitle(title);
        dayPlan.setActivities(activities);

        for (Activity activity : activities) {
            activity.setDayPlan(dayPlan);
        }

        return dayPlan;
    }

    private Activity createActivity(String time, String activityText, String icon) {
        Activity activity = new Activity();
        activity.setTime(time);
        activity.setActivity(activityText);
        activity.setIcon(icon);
        return activity;
    }

    private GroupTripSummaryResponse toSummary(GroupTrip trip) {
        List<GroupTripMember> members = groupTripMemberRepository.findByGroupTripIdOrderByJoinedAtAsc(trip.getId());
        List<GroupTripOption> options = groupTripOptionRepository.findByGroupTripIdOrderByLockedWinnerDescScoreDescCreatedAtAsc(trip.getId());
        long winnerCount = options.stream().filter(option -> Boolean.TRUE.equals(option.getLockedWinner())).count();

        return new GroupTripSummaryResponse(
                trip.getId(),
                trip.getTitle(),
                trip.getDestination(),
                trip.getInviteCode(),
                trip.getStatus(),
                members.size(),
                options.size(),
                (int) winnerCount,
                trip.getFinalizedItineraryId()
        );
    }

    private GroupTripOptionResponse toOptionResponse(GroupTripOption option, Long currentUserId) {
        List<GroupTripVote> votes = groupTripVoteRepository.findByOptionId(option.getId());
        Integer currentUserVote = votes.stream()
                .filter(vote -> vote.getUserId().equals(currentUserId))
                .map(GroupTripVote::getVoteValue)
                .findFirst()
                .orElse(0);

        return new GroupTripOptionResponse(
                option.getId(),
                option.getCategory().name(),
                option.getTitle(),
                option.getDescription(),
                option.getLocation(),
                option.getAddedByName(),
                option.getScore(),
                option.getLockedWinner(),
                currentUserVote,
                votes.stream().filter(vote -> vote.getVoteValue() == 1).count(),
                votes.stream().filter(vote -> vote.getVoteValue() == -1).count()
        );
    }

    private GroupTripOptionResponse pickWinner(List<GroupTripOptionResponse> options) {
        if (options.isEmpty()) {
            return null;
        }

        List<GroupTripOptionResponse> locked = options.stream()
                .filter(GroupTripOptionResponse::lockedWinner)
                .toList();
        if (!locked.isEmpty()) {
            return locked.get(0);
        }

        return new ArrayList<>(options).stream()
                .max(Comparator.comparing(GroupTripOptionResponse::score))
                .orElse(null);
    }

    private LinkedItineraryResponse toLinkedItineraryResponse(Long itineraryId) {
        if (itineraryId == null) {
            return null;
        }

        return itineraryRepository.findById(itineraryId)
                .map(itinerary -> new LinkedItineraryResponse(
                        itinerary.getId(),
                        itinerary.getTitle(),
                        itinerary.getDestination()
                ))
                .orElse(null);
    }

    public record CreateGroupTripRequest(String title, String destination, String description) {}

    public record JoinGroupTripRequest(String inviteCode) {}

    public record AddGroupTripOptionRequest(String category, String title, String description, String location) {}

    public record VoteRequest(int voteValue) {}

    public record GroupTripSummaryResponse(
            Long id,
            String title,
            String destination,
            String inviteCode,
            String status,
            int memberCount,
            int optionCount,
            int winnerCount,
            Long finalizedItineraryId
    ) {}

    public record GroupTripMemberResponse(
            Long id,
            Long userId,
            String userName,
            String joinedAt
    ) {}

    public record GroupTripOptionResponse(
            Long id,
            String category,
            String title,
            String description,
            String location,
            String addedByName,
            Integer score,
            Boolean lockedWinner,
            Integer currentUserVote,
            long upvotes,
            long downvotes
    ) {}

    public record GroupTripDetailResponse(
            Long id,
            String title,
            String destination,
            String description,
            String inviteCode,
            String status,
            boolean organizer,
            List<GroupTripMemberResponse> members,
            Map<String, List<GroupTripOptionResponse>> optionsByCategory,
            List<GroupTripOptionResponse> winners,
            LinkedItineraryResponse finalizedItinerary
    ) {}

    public record LinkedItineraryResponse(
            Long id,
            String title,
            String destination
    ) {}
}
