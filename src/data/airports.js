// Curated quick-pick airport list for the flight search autocomplete. TripJack's
// flight API has no city/airport lookup endpoint (unlike hotels, which sync a real
// catalog) - it just accepts any valid IATA code, so this list only powers the
// "type a city name and see suggestions" convenience. Users can still type a raw
// 3-letter IATA code directly for any airport not listed here (see
// resolveAirportCode in FlightsScreen.js).
export const AIRPORT_OPTIONS = [
  // North India
  { code: 'DEL', city: 'Delhi' },
  { code: 'ATQ', city: 'Amritsar' },
  { code: 'IXC', city: 'Chandigarh' },
  { code: 'IXJ', city: 'Jammu' },
  { code: 'SXR', city: 'Srinagar' },
  { code: 'IXL', city: 'Leh' },
  { code: 'DED', city: 'Dehradun' },
  { code: 'LKO', city: 'Lucknow' },
  { code: 'VNS', city: 'Varanasi' },
  { code: 'KNU', city: 'Kanpur' },
  { code: 'AGR', city: 'Agra' },
  { code: 'IXD', city: 'Prayagraj' },
  { code: 'GOP', city: 'Gorakhpur' },
  { code: 'JAI', city: 'Jaipur' },
  { code: 'JDH', city: 'Jodhpur' },
  { code: 'UDR', city: 'Udaipur' },
  { code: 'BKB', city: 'Bikaner' },

  // West India
  { code: 'BOM', city: 'Mumbai' },
  { code: 'PNQ', city: 'Pune' },
  { code: 'AMD', city: 'Ahmedabad' },
  { code: 'STV', city: 'Surat' },
  { code: 'BDQ', city: 'Vadodara' },
  { code: 'BHJ', city: 'Bhuj' },
  { code: 'PBD', city: 'Porbandar' },
  { code: 'NAG', city: 'Nagpur' },
  { code: 'ISK', city: 'Nashik' },
  { code: 'IXU', city: 'Aurangabad' },
  { code: 'GOI', city: 'Goa' },
  { code: 'GOX', city: 'Goa Mopa' },

  // South India
  { code: 'BLR', city: 'Bengaluru' },
  { code: 'MAA', city: 'Chennai' },
  { code: 'HYD', city: 'Hyderabad' },
  { code: 'COK', city: 'Kochi' },
  { code: 'TRV', city: 'Thiruvananthapuram' },
  { code: 'CCJ', city: 'Kozhikode' },
  { code: 'IXE', city: 'Mangalore' },
  { code: 'CJB', city: 'Coimbatore' },
  { code: 'IXM', city: 'Madurai' },
  { code: 'TRZ', city: 'Tiruchirapalli' },
  { code: 'TIR', city: 'Tirupati' },
  { code: 'VGA', city: 'Vijayawada' },
  { code: 'VTZ', city: 'Visakhapatnam' },
  { code: 'HBX', city: 'Hubli' },
  { code: 'MYQ', city: 'Mysuru' },

  // East India
  { code: 'CCU', city: 'Kolkata' },
  { code: 'BBI', city: 'Bhubaneswar' },
  { code: 'IXR', city: 'Ranchi' },
  { code: 'PAT', city: 'Patna' },
  { code: 'GAY', city: 'Gaya' },
  { code: 'RPR', city: 'Raipur' },
  { code: 'BHO', city: 'Bhopal' },
  { code: 'IDR', city: 'Indore' },
  { code: 'GWL', city: 'Gwalior' },
  { code: 'JLR', city: 'Jabalpur' },

  // Northeast India
  { code: 'GAU', city: 'Guwahati' },
  { code: 'DIB', city: 'Dibrugarh' },
  { code: 'JRH', city: 'Jorhat' },
  { code: 'IXS', city: 'Silchar' },
  { code: 'IXA', city: 'Agartala' },
  { code: 'IMF', city: 'Imphal' },
  { code: 'AJL', city: 'Aizawl' },
  { code: 'SHL', city: 'Shillong' },
  { code: 'DMU', city: 'Dimapur' },
  { code: 'IXB', city: 'Bagdogra' },

  // Islands
  { code: 'IXZ', city: 'Port Blair' },

  // Major international
  { code: 'DXB', city: 'Dubai' },
  { code: 'AUH', city: 'Abu Dhabi' },
  { code: 'SHJ', city: 'Sharjah' },
  { code: 'DOH', city: 'Doha' },
  { code: 'SIN', city: 'Singapore' },
  { code: 'KUL', city: 'Kuala Lumpur' },
  { code: 'BKK', city: 'Bangkok' },
  { code: 'DMK', city: 'Bangkok Don Mueang' },
  { code: 'HKG', city: 'Hong Kong' },
  { code: 'CMB', city: 'Colombo' },
  { code: 'KTM', city: 'Kathmandu' },
  { code: 'DAC', city: 'Dhaka' },
  { code: 'LHR', city: 'London' },
  { code: 'JFK', city: 'New York' },
];
