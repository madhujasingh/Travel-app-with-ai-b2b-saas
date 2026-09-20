// Maps navigator routes to real URLs so the web build has addressable pages:
// the browser back button works, refresh keeps you where you were, and hotel /
// flight pages can be shared. Native uses the same config through the
// `travelapp2://` scheme, so deep links resolve identically on both.
const linking = {
  prefixes: ['travelapp2://', 'https://myitineri.com', 'https://www.myitineri.com'],
  config: {
    screens: {
      Splash: '',
      Login: 'login',
      CustomerTabs: {
        path: '',
        screens: {
          HomeTab: 'home',
          AITab: 'ai-picks',
          PromotionsTab: 'deals',
          CartTab: 'cart',
          ProfileTab: 'profile',
        },
      },
      B2BDashboard: 'dashboard',

      // Packages and itineraries
      LandPackage: 'packages',
      ItineraryList: 'itineraries',
      ItineraryDetail: 'itineraries/:itineraryId',
      Customization: 'itineraries/:itineraryId/customize',
      Checkout: 'checkout',
      TalkToAgent: 'talk-to-agent',
      GroupTripPlanner: 'group-trips',

      // Hotels
      Hotels: 'hotels',
      HotelSearchResults: 'hotels/search',
      HotelDetail: 'hotels/:hotelId',
      HotelBooking: 'hotels/:hotelId/book',

      // Flights
      Flights: 'flights',
      FlightBooking: 'flights/book',
      FlightReissue: 'flights/reissue',
      MyFlightBookings: 'my-bookings/flights',

      // Activities
      Activities: 'activities',
      ActivityResults: 'activities/search',
      ActivityDetail: 'activities/:activityCode',
      ActivityBooking: 'activities/:activityCode/book',

      // Cabs
      Cabs: 'cabs',
      CabResults: 'cabs/search',
      CabBooking: 'cabs/book',

      // TripSafe insurance
      TripSafe: 'insurance',
      TripSafeResults: 'insurance/quotes',
      TripSafeBooking: 'insurance/book',

      // AI
      AIRecommendations: 'ai-picks',
      AIPlaceInsight: 'ai-picks/:placeName',

      // Messaging
      ChatInbox: 'messages',
      ChatScreen: 'messages/:conversationId',

      // B2B / admin
      AdminItineraryUpload: 'admin/itineraries/upload',
      SupplierNetwork: 'admin/suppliers',
      PromoBanners: 'admin/promo-banners',
      HotelCatalogAdmin: 'admin/hotel-catalog',
      AdminPlatformSettings: 'admin/settings',
      AdminPosterStudio: 'admin/poster-studio',
      AdminCoupons: 'admin/coupons',
      AdminMarkup: 'admin/markup',
      RequestDetail: 'admin/requests/:requestId',
      CreatePackage: 'supplier/packages/new',
      SupplierRequests: 'supplier/requests',
      Reports: 'reports',
    },
  },
};

export default linking;
