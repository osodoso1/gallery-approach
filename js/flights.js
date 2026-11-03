/* SFO arrivals — live ADS-B positions, route + photo lookups, aircraft trivia,
   and a clearly-labelled simulation for when live data can't be reached. */
(function () {
  'use strict';
  const U = SS.u, G = U.geo;
  const F = (SS.flights = { list: [], featured: null, lastSeen: U.store.get('lastFlight', null), history: U.store.get('flightHistory', []), status: { mode: 'starting', source: '', at: 0, count: 0, msg: '' } });

  /* ── Reference data ─────────────────────────────── */
  // [city, lat, lon]
  const AP = {
    SFO: ['San Francisco', 37.6189, -122.375], OAK: ['Oakland', 37.7126, -122.2197], SJC: ['San José', 37.3639, -121.9289], SMF: ['Sacramento', 38.6954, -121.5908],
    LAX: ['Los Angeles', 33.9416, -118.4085], SAN: ['San Diego', 32.7338, -117.1933], BUR: ['Burbank', 34.2007, -118.3587], SNA: ['Santa Ana', 33.6762, -117.8675], PSP: ['Palm Springs', 33.8303, -116.5067], ONT: ['Ontario', 34.056, -117.6012],
    SEA: ['Seattle', 47.4502, -122.3088], PDX: ['Portland', 45.5898, -122.5951], LAS: ['Las Vegas', 36.084, -115.1537], PHX: ['Phoenix', 33.4373, -112.0078], RNO: ['Reno', 39.4991, -119.7681],
    DEN: ['Denver', 39.8561, -104.6737], SLC: ['Salt Lake City', 40.7899, -111.9791], ORD: ['Chicago', 41.9742, -87.9073], MSP: ['Minneapolis', 44.8848, -93.2223], DFW: ['Dallas–Fort Worth', 32.8998, -97.0403],
    IAH: ['Houston', 29.9902, -95.3368], AUS: ['Austin', 30.1975, -97.6664], ATL: ['Atlanta', 33.6407, -84.4277], MCO: ['Orlando', 28.4312, -81.3081], MIA: ['Miami', 25.7959, -80.287],
    JFK: ['New York JFK', 40.6413, -73.7781], EWR: ['Newark', 40.6895, -74.1745], BOS: ['Boston', 42.3656, -71.0096], IAD: ['Washington Dulles', 38.9531, -77.4565], PHL: ['Philadelphia', 39.8744, -75.2424], DTW: ['Detroit', 42.2162, -83.3554], CLT: ['Charlotte', 35.2144, -80.9473],
    HNL: ['Honolulu', 21.3245, -157.9251], OGG: ['Kahului, Maui', 20.8986, -156.4305], KOA: ['Kona', 19.7388, -156.0456], ANC: ['Anchorage', 61.1743, -149.9962],
    YVR: ['Vancouver', 49.1967, -123.1815], YYZ: ['Toronto', 43.6777, -79.6248], YUL: ['Montréal', 45.4706, -73.7408], MEX: ['Mexico City', 19.4361, -99.0719], GDL: ['Guadalajara', 20.5218, -103.3112], SJD: ['Los Cabos', 23.1518, -109.7215], CUN: ['Cancún', 21.0365, -86.8771],
    NRT: ['Tokyo Narita', 35.772, 140.3929], HND: ['Tokyo Haneda', 35.5494, 139.7798], ICN: ['Seoul', 37.4602, 126.4407], TPE: ['Taipei', 25.0797, 121.2342], HKG: ['Hong Kong', 22.308, 113.9185], SIN: ['Singapore', 1.3644, 103.9915], MNL: ['Manila', 14.5086, 121.0194], PVG: ['Shanghai', 31.1443, 121.8083],
    SYD: ['Sydney', -33.9399, 151.1753], AKL: ['Auckland', -37.0082, 174.785], DEL: ['Delhi', 28.5562, 77.1], BLR: ['Bengaluru', 13.1986, 77.7066], DXB: ['Dubai', 25.2532, 55.3657], DOH: ['Doha', 25.2731, 51.6081], IST: ['Istanbul', 41.2753, 28.7519],
    LHR: ['London Heathrow', 51.47, -0.4543], CDG: ['Paris', 49.0097, 2.5479], FRA: ['Frankfurt', 50.0379, 8.5622], MUC: ['Munich', 48.3537, 11.775], ZRH: ['Zürich', 47.4582, 8.5555], AMS: ['Amsterdam', 52.3105, 4.7683], DUB: ['Dublin', 53.4264, -6.2499], CPH: ['Copenhagen', 55.618, 12.6508], MAD: ['Madrid', 40.4983, -3.5676],
  };
  F.AP = AP;
  // ICAO → [name, IATA]
  const AL = {
    UAL: ['United Airlines', 'UA'], ASA: ['Alaska Airlines', 'AS'], QXE: ['Horizon Air (Alaska)', 'QX'], SKW: ['SkyWest', 'OO'], DAL: ['Delta Air Lines', 'DL'], AAL: ['American Airlines', 'AA'], SWA: ['Southwest Airlines', 'WN'],
    JBU: ['JetBlue', 'B6'], FFT: ['Frontier', 'F9'], NKS: ['Spirit', 'NK'], HAL: ['Hawaiian Airlines', 'HA'], SCX: ['Sun Country', 'SY'], ENY: ['Envoy', 'MQ'], RPA: ['Republic Airways', 'YX'], CPZ: ['Compass', 'CP'],
    ACA: ['Air Canada', 'AC'], WJA: ['WestJet', 'WS'], POE: ['Porter Airlines', 'PD'], AMX: ['Aeroméxico', 'AM'], VOI: ['Volaris', 'Y4'], VIV: ['Viva Aerobus', 'VB'],
    BAW: ['British Airways', 'BA'], VIR: ['Virgin Atlantic', 'VS'], AFR: ['Air France', 'AF'], KLM: ['KLM', 'KL'], DLH: ['Lufthansa', 'LH'], SWR: ['Swiss', 'LX'], EIN: ['Aer Lingus', 'EI'], IBE: ['Iberia', 'IB'], SAS: ['SAS', 'SK'], THY: ['Turkish Airlines', 'TK'],
    UAE: ['Emirates', 'EK'], QTR: ['Qatar Airways', 'QR'], ETD: ['Etihad', 'EY'], AIC: ['Air India', 'AI'], SIA: ['Singapore Airlines', 'SQ'], CPA: ['Cathay Pacific', 'CX'], EVA: ['EVA Air', 'BR'], CAL: ['China Airlines', 'CI'], SJX: ['STARLUX', 'JX'],
    KAL: ['Korean Air', 'KE'], AAR: ['Asiana', 'OZ'], ANA: ['ANA', 'NH'], JAL: ['Japan Airlines', 'JL'], TZP: ['ZIPAIR', 'ZG'], PAL: ['Philippine Airlines', 'PR'], CCA: ['Air China', 'CA'], CES: ['China Eastern', 'MU'], CSN: ['China Southern', 'CZ'],
    QFA: ['Qantas', 'QF'], ANZ: ['Air New Zealand', 'NZ'], FDX: ['FedEx', 'FX'], UPS: ['UPS Airlines', '5X'], GTI: ['Atlas Air', '5Y'], ABX: ['ABX Air', 'GB'],
  };
  F.AL = AL;
  // ICAO type → [display name, kind, typical seats min, max, fact]
  const TY = {
    A319: ['Airbus A319', 'narrow', 120, 150, 'A shortened A320 with the same cockpit and fly-by-wire controls, so pilots can fly the whole family on one type rating.'],
    A320: ['Airbus A320', 'narrow', 150, 180, 'The first airliner with digital fly-by-wire and a sidestick instead of a control yoke (1988).'],
    A20N: ['Airbus A320neo', 'narrow', 150, 186, '"neo" means New Engine Option: much bigger-fan engines (CFM LEAP or Pratt & Whitney GTF) that burn roughly a fifth less fuel.'],
    A321: ['Airbus A321', 'narrow', 185, 220, 'The stretched member of the A320 family, with double-slotted flaps to carry the extra length and weight.'],
    A21N: ['Airbus A321neo', 'narrow', 180, 220, 'The XLR version can fly about 4,700 nautical miles, far enough for a single-aisle jet to cross the Atlantic.'],
    BCS1: ['Airbus A220-100', 'narrow', 100, 135, 'Designed by Bombardier as the CSeries. Known for oversized windows and a roomy 2-3 seat layout.'],
    BCS3: ['Airbus A220-300', 'narrow', 120, 150, 'Born as the Bombardier CSeries. Look for the big windows and the Pratt & Whitney geared turbofans.'],
    A332: ['Airbus A330-200', 'wide', 210, 250, 'Developed alongside the four-engine A340, so the two share the same wing design.'],
    A333: ['Airbus A330-300', 'wide', 250, 300, 'A long-range twin that shares its wing and cockpit philosophy with the A340.'],
    A339: ['Airbus A330-900neo', 'wide', 260, 300, 'Rolls-Royce Trent 7000 engines and a new 64 m wing with curved sharklet tips.'],
    A359: ['Airbus A350-900', 'wide', 300, 325, 'More than half its structure is carbon-fiber composite. Look for the black "raccoon mask" around the cockpit windows.'],
    A35K: ['Airbus A350-1000', 'wide', 350, 410, 'The largest twin-engine Airbus. Its main landing gear has six wheels per leg instead of four.'],
    A388: ['Airbus A380', 'jumbo', 480, 575, 'The largest passenger airliner ever built: a full-length double-decker with a 79.8 m wingspan.'],
    B712: ['Boeing 717', 'narrow', 110, 134, 'Started life as the McDonnell Douglas MD-95. The last of the DC-9 line.'],
    B737: ['Boeing 737-700', 'narrow', 128, 149, 'The 737 has been in production since 1967, longer than any other jetliner family.'],
    B738: ['Boeing 737-800', 'narrow', 160, 189, 'The best-selling 737 variant. Its engines have a flattened bottom (the "hamster pouch") to clear the ground.'],
    B739: ['Boeing 737-900', 'narrow', 178, 220, 'The longest 737 NG. The ER version adds an extra pair of exit doors behind the wing.'],
    B38M: ['Boeing 737 MAX 8', 'narrow', 162, 189, 'LEAP-1B engines with sawtooth chevrons on the nacelles to cut noise, plus split-tip "AT" winglets.'],
    B39M: ['Boeing 737 MAX 9', 'narrow', 178, 220, 'A stretched MAX 8. Same sawtooth engine chevrons and split-tip winglets.'],
    B752: ['Boeing 757-200', 'narrow', 176, 200, 'So much thrust for its size that it climbs steeply out of short or hot-and-high runways. Pilots love it.'],
    B753: ['Boeing 757-300', 'narrow', 230, 243, 'At 54.5 m, the longest single-aisle twinjet ever built.'],
    B763: ['Boeing 767-300', 'wide', 210, 260, 'The 767 pioneered twin-engine long-haul (ETOPS) flying across the Atlantic in the mid-1980s.'],
    B764: ['Boeing 767-400ER', 'wide', 238, 300, 'The longest 767, with raked wingtips and a 777-style cabin.'],
    B772: ['Boeing 777-200', 'wide', 300, 360, "Boeing's first fly-by-wire airliner, and the first jetliner designed entirely on computer."],
    B77W: ['Boeing 777-300ER', 'wide', 300, 396, 'Its GE90-115B engines were the most powerful jet engines in service for nearly two decades. Each fan is about 3.25 m across.'],
    B77L: ['Boeing 777-200LR / 777F', 'wide', 300, 317, 'Built for extreme range: a 777-200LR flew 11,664 nm nonstop from Hong Kong to London (the long way) in 2005. The 777 Freighter shares this type code.'],
    B788: ['Boeing 787-8 Dreamliner', 'wide', 240, 250, 'About half composite by weight. Electronically dimmable windows replace pull-down shades.'],
    B789: ['Boeing 787-9 Dreamliner', 'wide', 257, 296, 'The cabin is pressurized to about 6,000 ft instead of the usual 8,000, and the air is more humid, so long flights feel less tiring.'],
    B78X: ['Boeing 787-10 Dreamliner', 'wide', 318, 336, 'The longest Dreamliner at 68 m. It trades some range for about 40 more seats than the 787-9.'],
    B744: ['Boeing 747-400', 'jumbo', 400, 416, 'The "Queen of the Skies". The hump holds the cockpit and an upper deck. Most remaining 747-400s fly cargo.'],
    B748: ['Boeing 747-8', 'jumbo', 410, 467, 'At 76.3 m, one of the longest airliners ever built. The final 747 left the factory in 2023.'],
    MD11: ['McDonnell Douglas MD-11', 'wide', 0, 0, 'A three-engine jet descended from the DC-10. Almost every MD-11 still flying is a freighter.'],
    E170: ['Embraer 170', 'regional', 66, 78, 'The smallest member of the E-Jet family. Seats are 2-2 with no middle seat.'],
    E75L: ['Embraer 175', 'regional', 76, 88, 'The workhorse of US regional flying. Airline "scope clauses" cap many regional jets at 76 seats, and the E175 fits that limit exactly.'],
    E75S: ['Embraer 175', 'regional', 76, 88, 'The backbone of US regional flying. No middle seats: it is 2-2 throughout.'],
    E190: ['Embraer 190', 'regional', 96, 114, 'A 2-2 regional jet that flies like a small mainline jet.'],
    E295: ['Embraer E195-E2', 'regional', 120, 146, "Porter's E195-E2s are set up 2-2 with no middle seats, and geared turbofans make them very quiet."],
    CRJ2: ['Bombardier CRJ200', 'regional', 50, 50, "Stretched from Bombardier's Challenger business jet."],
    CRJ7: ['Bombardier CRJ700', 'regional', 65, 78, 'A stretched CRJ, originally derived from the Challenger business jet.'],
    CRJ9: ['Bombardier CRJ900', 'regional', 76, 90, 'The longest commonly flown CRJ, a descendant of the Challenger business jet.'],
    DH8D: ['De Havilland Dash 8-400', 'prop', 68, 82, 'One of the fastest turboprop airliners, cruising at around 360 knots.'],
    AT76: ['ATR 72-600', 'prop', 68, 78, 'A twin turboprop built for short hops. Very fuel-efficient on short routes.'],
    C172: ['Cessna 172 Skyhawk', 'light', 0, 0, 'The most-produced aircraft in history: more than 44,000 built.'],
    SR22: ['Cirrus SR22', 'light', 0, 0, 'Comes with a whole-airplane parachute (CAPS) as standard.'],
    PC12: ['Pilatus PC-12', 'prop', 0, 0, 'A single-engine turboprop with a big cargo door, popular with air-ambulance operators.'],
    GLF6: ['Gulfstream G650', 'bizjet', 0, 0, 'Cruises up to Mach 0.925, among the fastest civil jets flying.'],
    GL7T: ['Bombardier Global 7500', 'bizjet', 0, 0, 'Built for range: about 7,700 nm, enough to link most of the world nonstop.'],
  };
  F.TY = TY;
  const KIND_BY_CAT = { A1: 'light', A2: 'regional', A3: 'narrow', A4: 'narrow', A5: 'wide', A7: 'heli' };

  /* ── Illustrations for when there's no real photo (simulated flights, or none on file) ── */
  F.family = code => {
    code = (code || '').toUpperCase();
    if (/^B74/.test(code)) return 'b747';
    if (code === 'A388') return 'a380';
    if (/^(CRJ\d|GLF\d|GL7T|GLEX|CL\d\d|C68A|C56X|E55P|LJ\d\d|F2TH|FA\d\w)$/.test(code)) return 'rear';
    if (/^(DH8\w|AT\d\d|PC12|B190|SF34)$/.test(code)) return 'prop';
    if (/^(C1\d\d|SR2\d|PA\d\d|DA4\d|BE\d\d)$/.test(code)) return 'light';
    if (code === 'MD11' || code === 'DC10') return 'trijet';
    const k = TY[code] && TY[code][1];
    return k === 'wide' || k === 'jumbo' ? 'wide' : k === 'regional' ? 'regional' : 'narrow';
  };
  let artSeq = 0;
  F.art = function (code) {
    const fam = F.family(code), id = 'pa' + (++artSeq);
    const D = { narrow: [222, 24], wide: [252, 34], b747: [258, 35], a380: [242, 50], regional: [196, 21], rear: [176, 18], prop: [196, 21], light: [128, 17], trijet: [248, 34] }[fam];
    const [L, h] = D, cy = 100, x0 = 160 - L / 2, nose = 160 + L / 2, top = cy - h / 2, bot = cy + h / 2, nl = h * 0.95;
    const f = n => n.toFixed(1);
    const body = `M${f(x0)} ${f(top + h * 0.12)} L${f(x0 + h * 1.1)} ${f(top)} L${f(nose - nl)} ${f(top)} Q${f(nose)} ${f(top + h * 0.04)} ${f(nose)} ${f(cy + h * 0.18)} Q${f(nose - 2)} ${f(bot)} ${f(nose - nl)} ${f(bot)} L${f(x0 + h * 2.4)} ${f(bot)} Q${f(x0 + h * 1.1)} ${f(bot - h * 0.05)} ${f(x0)} ${f(cy - h * 0.08)} Z`;
    const finH = h * (fam === 'light' ? 1.3 : fam === 'a380' ? 1.15 : 1.5);
    const fin = `M${f(x0 + h * 0.15)} ${f(top + h * 0.1)} L${f(x0 - h * 0.2)} ${f(top - finH)} L${f(x0 + h * 0.62)} ${f(top - finH)} L${f(x0 + h * 2.5)} ${f(top + 1)} Z`;
    const tTail = fam === 'rear' ? `<path d="M${f(x0 - h * 0.6)} ${f(top - finH + 1)} L${f(x0 + h * 1.0)} ${f(top - finH - 1)} L${f(x0 + h * 1.0)} ${f(top - finH + 3)} L${f(x0 - h * 0.5)} ${f(top - finH + 4)} Z" fill="url(#${id}t)"/>`
      : `<path d="M${f(x0 + h * 0.1)} ${f(cy - h * 0.05)} L${f(x0 - h * 0.55)} ${f(cy - h * 0.2)} L${f(x0 - h * 0.35)} ${f(cy - h * 0.02)} L${f(x0 + h * 1.6)} ${f(cy + h * 0.12)} Z" fill="#9aa3b2"/>`;
    const high = fam === 'prop' || fam === 'light';
    const wx = x0 + L * (high ? 0.5 : 0.56);
    const wing = high
      ? `<path d="M${f(wx - h * 1.6)} ${f(top + 1)} L${f(wx + h * 1.4)} ${f(top + 1)} L${f(wx + h * 1.2)} ${f(top - h * 0.12)} L${f(wx - h * 1.5)} ${f(top - h * 0.12)} Z" fill="#7d8698"/>`
      : `<path d="M${f(wx)} ${f(cy + h * 0.22)} L${f(wx + h * 2.6)} ${f(cy + h * 0.3)} L${f(wx - h * 1.5)} ${f(cy + h * 1.05)} L${f(wx - h * 2.1)} ${f(cy + h * 1.05)} Z" fill="url(#${id}w)"/>`;
    const pod = (cx, ey, rx, ry) => `<ellipse cx="${f(cx)}" cy="${f(ey)}" rx="${f(rx)}" ry="${f(ry)}" fill="url(#${id}e)"/><ellipse cx="${f(cx + rx * 0.86)}" cy="${f(ey)}" rx="${f(rx * 0.16)}" ry="${f(ry * 0.86)}" fill="#20283a"/>`;
    let engines = '';
    if (fam === 'b747' || fam === 'a380') engines = pod(wx - h * 0.9, cy + h * 0.95, h * 0.55, h * 0.22) + pod(wx + h * 0.45, cy + h * 0.66, h * 0.62, h * 0.26);
    else if (fam === 'rear') engines = pod(x0 + h * 2.3, cy - h * 0.42, h * 0.95, h * 0.33);
    else if (fam === 'trijet') engines = pod(wx + h * 0.4, cy + h * 0.7, h * 0.72, h * 0.3) + pod(x0 + h * 0.9, top - h * 0.28, h * 0.8, h * 0.26);
    else if (fam === 'prop') engines = pod(wx + h * 0.6, top - h * 0.05, h * 0.75, h * 0.24) + `<ellipse cx="${f(wx + h * 1.4)}" cy="${f(top - h * 0.05)}" rx="${f(h * 0.08)}" ry="${f(h * 0.9)}" fill="rgba(255,255,255,.35)"/>`;
    else if (fam === 'light') engines = `<ellipse cx="${f(nose + 1)}" cy="${f(cy)}" rx="${f(h * 0.08)}" ry="${f(h * 0.85)}" fill="rgba(255,255,255,.4)"/>`;
    else engines = pod(wx + h * 0.4, cy + h * 0.7, h * (fam === 'wide' ? 0.82 : 0.68), h * (fam === 'wide' ? 0.33 : 0.3));
    const hump = fam === 'b747' ? `<path d="M${f(nose - L * 0.36)} ${f(top + 1)} Q${f(nose - L * 0.3)} ${f(top - h * 0.34)} ${f(nose - L * 0.2)} ${f(top - h * 0.3)} L${f(nose - nl * 0.85)} ${f(top - h * 0.22)} Q${f(nose - nl * 0.25)} ${f(top - h * 0.08)} ${f(nose - nl * 0.2)} ${f(top + h * 0.15)} Z" fill="url(#${id}b)"/>` : '';
    const winY = [cy - h * 0.13].concat(fam === 'a380' ? [cy - h * 0.34] : []);
    const wins = winY.map(y => `<line x1="${f(x0 + h * 2.1)}" y1="${f(y)}" x2="${f(nose - nl * 1.05)}" y2="${f(y)}" stroke="#3a4358" stroke-width="${f(Math.max(1.4, h * 0.09))}" stroke-dasharray="${f(Math.max(1.4, h * 0.09))} ${f(Math.max(2.2, h * 0.15))}" stroke-linecap="round"/>`).join('')
      + (fam === 'b747' ? `<line x1="${f(nose - L * 0.27)}" y1="${f(top - h * 0.12)}" x2="${f(nose - nl * 1.1)}" y2="${f(top - h * 0.1)}" stroke="#3a4358" stroke-width="${f(h * 0.08)}" stroke-dasharray="${f(h * 0.08)} ${f(h * 0.14)}" stroke-linecap="round"/>` : '');
    const cockpit = `<path d="M${f(nose - nl * 0.55)} ${f(cy - h * 0.2)} L${f(nose - nl * 0.18)} ${f(cy - h * 0.12)} L${f(nose - nl * 0.3)} ${f(cy - h * 0.3)} Z" fill="#2a3247"/>`;
    const cheat = `<path d="M${f(x0 + h * 1.6)} ${f(cy + h * 0.12)} L${f(nose - nl * 0.6)} ${f(cy + h * 0.12)}" stroke="#ffb547" stroke-opacity=".75" stroke-width="${f(Math.max(1, h * 0.06))}"/>`;
    const svg = `<defs>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2640"/><stop offset=".62" stop-color="#3f5a80"/><stop offset="1" stop-color="#c99577"/></linearGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".62" stop-color="#e6e8ec"/><stop offset="1" stop-color="#b9bfca"/></linearGradient>
      <linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a5b7a"/><stop offset="1" stop-color="#28334a"/></linearGradient>
      <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a3abb9"/><stop offset="1" stop-color="#6c7588"/></linearGradient>
      <linearGradient id="${id}e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d7dbe2"/><stop offset="1" stop-color="#8a93a3"/></linearGradient>
    </defs>
    <rect width="320" height="180" fill="url(#${id}s)"/>
    <circle cx="262" cy="150" r="46" fill="#ffd9b0" opacity=".18"/><circle cx="262" cy="150" r="20" fill="#ffe7cc" opacity=".35"/>
    <path d="M0 158 Q80 148 160 156 T320 152 V180 H0Z" fill="#141a2a" opacity=".55"/>
    ${high ? '' : wing}<path d="${fin}" fill="url(#${id}t)"/>${tTail}<path d="${body}" fill="url(#${id}b)"/>${hump}${cheat}${wins}${cockpit}${high ? wing : ''}${engines}`;
    const el = U.svg(svg, '0 0 320 180');
    el.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    el.classList.add('plane-art');
    return el;
  };
  F.silhouette = (kind, code) => F.art(code || ({ wide: 'B789', jumbo: 'B748', regional: 'E75L', prop: 'DH8D', light: 'C172', bizjet: 'GLF6' }[kind] || 'A320'));

  /* ── Real photos ──────────────────────────────────
     1. Planespotters: this exact plane (live flights, looked up in enrich()).
     2. Wikimedia Commons: this registration, then this airline + type, then Wikipedia's lead
        photo of the type. Free-licence photos, always credited. Cached on the device. */
  // Words that match how Commons files are usually named.
  const PQ = {
    A319: 'A319', A320: 'A320', A20N: 'A320neo', A321: 'A321', A21N: 'A321neo', BCS1: 'A220-100', BCS3: 'A220-300', A332: 'A330-200', A333: 'A330-300', A339: 'A330-900',
    A359: 'A350-900', A35K: 'A350-1000', A388: 'A380', B712: '717', B737: '737-700', B738: '737-800', B739: '737-900', B38M: '737 MAX 8', B39M: '737 MAX 9',
    B752: '757-200', B753: '757-300', B763: '767-300', B764: '767-400', B772: '777-200', B77W: '777-300ER', B77L: '777-200LR', B788: '787-8', B789: '787-9', B78X: '787-10',
    B744: '747-400', B748: '747-8', MD11: 'MD-11', E170: 'E170', E75L: 'E175', E75S: 'E175', E190: 'E190', E295: 'E195-E2', CRJ2: 'CRJ200', CRJ7: 'CRJ700', CRJ9: 'CRJ900', DH8D: 'Dash 8-400', AT76: 'ATR 72-600',
  };
  // Wikipedia article whose lead photo shows the type.
  const WK = {
    A319: 'Airbus A319', A320: 'Airbus A320 family', A20N: 'Airbus A320neo family', A321: 'Airbus A321', A21N: 'Airbus A321neo', BCS1: 'Airbus A220', BCS3: 'Airbus A220',
    A332: 'Airbus A330', A333: 'Airbus A330', A339: 'Airbus A330neo', A359: 'Airbus A350', A35K: 'Airbus A350', A388: 'Airbus A380', B712: 'Boeing 717',
    B737: 'Boeing 737 Next Generation', B738: 'Boeing 737 Next Generation', B739: 'Boeing 737 Next Generation', B38M: 'Boeing 737 MAX', B39M: 'Boeing 737 MAX',
    B752: 'Boeing 757', B753: 'Boeing 757', B763: 'Boeing 767', B764: 'Boeing 767', B772: 'Boeing 777', B77W: 'Boeing 777', B77L: 'Boeing 777',
    B788: 'Boeing 787 Dreamliner', B789: 'Boeing 787 Dreamliner', B78X: 'Boeing 787 Dreamliner', B744: 'Boeing 747-400', B748: 'Boeing 747-8', MD11: 'McDonnell Douglas MD-11',
    E170: 'Embraer E-Jet family', E75L: 'Embraer E-Jet family', E75S: 'Embraer E-Jet family', E190: 'Embraer E-Jet family', E295: 'Embraer E-Jet E2 family',
    CRJ2: 'Bombardier CRJ100/200', CRJ7: 'Bombardier CRJ700 series', CRJ9: 'Bombardier CRJ700 series', DH8D: 'De Havilland Canada Dash 8', AT76: 'ATR 72',
    C172: 'Cessna 172', SR22: 'Cirrus SR22', PC12: 'Pilatus PC-12', GLF6: 'Gulfstream G650', GL7T: 'Bombardier Global 7500',
  };
  const COMMONS = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*';
  const II = '&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1280&iiextmetadatafilter=Artist|LicenseShortName';
  const NOT_EXTERIOR = /cabin|seat|interior|cockpit|flight.?deck|galley|lounge|lavator|toilet|meal|menu|model|toy|diorama|lego|livery|drawing|render|diagram|\bmap\b|logo|sticker|ticket|boarding|uniform|crew|wreck|crash|accident|engine|nacelle|winglet|landing.?gear|wheel|close.?up|detail|window|\bdoor|screen|museum|scale/i;
  const NICE = /landing|approach|final|take.?off|departing|arriving|in.?flight|airborne|climb|rotat|touch.?down|\bSFO\b|San.Francisco/i;
  const tpCache = U.store.get('typePhotos', {}), tpPending = new Set(), tpFail = {};
  const saveTP = U.debounce(() => { const k = Object.keys(tpCache); k.slice(0, Math.max(0, k.length - 150)).forEach(x => delete tpCache[x]); U.store.set('typePhotos', tpCache); }, 2000);
  const fromII = (p, ii) => {
    const em = ii.extmetadata || {}, v = k => U.text(em[k] && em[k].value);
    return { src: ii.thumburl || ii.url, link: ii.descriptionurl, by: U.truncate(v('Artist') || 'unknown photographer', 60), license: v('LicenseShortName') || 'see file page', site: 'Wikimedia Commons' };
  };
  async function commonsSearch(q) {
    const d = await U.fetchJSON(COMMONS + '&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=' + encodeURIComponent(q + ' filetype:bitmap') + II, { timeout: 9000 });
    const list = Object.values((d.query && d.query.pages) || {}).map(p => ({ p, ii: p.imageinfo && p.imageinfo[0] }))
      .filter(({ p, ii }) => ii && /image\/(jpeg|png|webp)/.test(ii.mime || '') && ii.width >= 900 && ii.width / ii.height > 1.2 && ii.width / ii.height < 2.6 && !NOT_EXTERIOR.test(p.title));
    list.sort((a, b) => (NICE.test(b.p.title) - NICE.test(a.p.title)) || ((a.p.index || 0) - (b.p.index || 0)));
    return list[0] ? fromII(list[0].p, list[0].ii) : null;
  }
  async function wikiLead(title) {
    const w = await U.fetchJSON('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=name&titles=' + encodeURIComponent(title), { timeout: 9000 });
    const pg = Object.values((w.query && w.query.pages) || {})[0];
    if (!pg || !pg.pageimage) return null;
    const d = await U.fetchJSON(COMMONS + '&titles=' + encodeURIComponent('File:' + pg.pageimage) + II, { timeout: 9000 });
    const p = Object.values((d.query && d.query.pages) || {})[0], ii = p && p.imageinfo && p.imageinfo[0];
    return ii && /image\/(jpeg|png|webp)/.test(ii.mime || '') ? fromII(p, ii) : null;
  }
  const cleanAirline = n => (n || '').replace(/\s*\(.*\)\s*$/, '').trim();
  function photoPlan(a) {
    const info = a.info || {}, acf = info.aircraft || {}, route = info.route || {};
    const code = (a.type || acf.icao || '').toUpperCase();
    const reg = (acf.reg || a.reg || '').toUpperCase();
    const m = /^([A-Z]{3})\d/.exec(a.cs || '');
    const airline = cleanAirline(route.airline || (m && AL[m[1]] && AL[m[1]][0]) || '');
    const plan = [];
    if (reg && !a.sim) plan.push({ scope: 'reg', key: 'reg:' + reg, reg, run: () => commonsSearch(`"${reg}"`) });
    if (airline && PQ[code]) plan.push({ scope: 'airline', key: `al:${airline}|${code}`, airline, run: () => commonsSearch(`"${airline}" "${PQ[code]}"`) });
    const art = WK[code];
    if (art) plan.push({ scope: 'type', key: 'ty:' + art, article: art, run: () => wikiLead(art) });
    return plan;
  }
  const stale = c => !c || (!c.src && Date.now() - c.t > 3 * 864e5);
  function resolve(plan) {
    const id = plan.map(p => p.key).join('>');
    if (!plan.length || tpPending.has(id) || Date.now() - (tpFail[id] || 0) < 120e3 || SS.env.cspBlocked) return;
    tpPending.add(id);
    (async () => {
      for (const step of plan) {
        let c = tpCache[step.key];
        if (stale(c)) {
          let r;
          try { r = await step.run(); } catch (e) { tpFail[id] = Date.now(); break; } // offline: try again later, don't remember "none"
          c = tpCache[step.key] = r ? { ...r, t: Date.now() } : { t: Date.now() };
          saveTP();
        }
        if (c.src) break;
      }
      tpPending.delete(id);
      SS.emit('flights');
    })();
  }
  // Best real photo for an aircraft, or { src: null, pending } while we look (or if there's none).
  F.realPhoto = function (a) {
    if (!a) return { src: null };
    const info = a.info || {};
    if (info.photo && info.photo.src) return Object.assign({ scope: 'exact' }, info.photo);
    if (!a.sim && !a.info && !SS.env.cspBlocked) return { src: null, pending: true }; // route + Planespotters first
    const plan = photoPlan(a);
    for (const step of plan) {
      const c = tpCache[step.key];
      if (c && c.src) return Object.assign({ scope: step.scope, reg: step.reg, airline: step.airline, article: step.article }, c);
      if (stale(c)) { resolve(plan); return { src: null, pending: !SS.env.cspBlocked && Date.now() - (tpFail[plan.map(p => p.key).join('>')] || 0) > 120e3 }; }
    }
    return { src: null };
  };
  const an = w => (/^[AEIOU]/i.test(w || '') && !/^(uni|use|usa|eu|one)/i.test(w) ? 'an' : 'a');
  const An = w => { const x = an(w); return x[0].toUpperCase() + x.slice(1); };

  // Where the picture on the flight card came from, in plain words.
  F.photoNote = function (a, d, view) {
    const ph = d && d.photo, tn = (d && d.typeName) || 'plane';
    if (view !== 'drawing' && ph && ph.src) {
      const credit = ph.site === 'Wikimedia Commons' ? `Photo: ${ph.by} · ${ph.license} · Wikimedia Commons` : `Photo © ${ph.by || 'photographer'} · ${ph.site}`;
      const what = ph.scope === 'exact' ? '' : ph.scope === 'reg' ? `This plane, ${ph.reg}. ` : ph.scope === 'airline' ? `${An(ph.airline)} ${ph.airline} ${tn}, not this exact plane. ` : `${An(ph.article)} ${ph.article}, not this exact plane. `;
      return { text: what + credit, link: ph.link };
    }
    const base = `Drawing of ${an(tn)} ${tn}, made by this app.`;
    if (view === 'drawing') return { text: base };
    if (SS.env.cspBlocked) return { text: `${base} Real photos can't load in this hosted preview.` };
    if (d && d.photoPending) return { text: `${base} Looking for a real photo…` };
    return { text: `${base} No free photo of it turned up.` };
  };

  /* ── Airport geometry ─────────────────────────────── */
  F.airport = () => {
    const code = (SS.settings.flight.airport || 'SFO').toUpperCase();
    const a = AP[code] || AP.SFO;
    return { code: AP[code] ? code : 'SFO', city: a[0], lat: a[1], lon: a[2] };
  };
  // SFO runways 28L/28R: true course ≈ 298°, thresholds on the bay side.
  F.RWY28 = { lat: 37.6125, lon: -122.3572, crs: 297.9 };

  /* ── Live providers (free, keyless, community-run) ── */
  const PROVIDERS = [
    { id: 'adsb.lol', home: 'https://adsb.lol', url: (la, lo, r) => `https://api.adsb.lol/v2/point/${la.toFixed(4)}/${lo.toFixed(4)}/${r}` },
    { id: 'airplanes.live', home: 'https://airplanes.live', url: (la, lo, r) => `https://api.airplanes.live/v2/point/${la.toFixed(4)}/${lo.toFixed(4)}/${r}` },
    { id: 'adsb.fi', home: 'https://adsb.fi', url: (la, lo, r) => `https://opendata.adsb.fi/api/v2/lat/${la.toFixed(4)}/lon/${lo.toFixed(4)}/dist/${r}` },
  ];
  let provIdx = 0, liveFails = 0, timer = null, lastLiveTry = 0;

  function normalize(d) {
    const now = Date.now();
    return (d.ac || d.aircraft || []).filter(a => a.lat != null && a.lon != null && a.hex).map(a => ({
      hex: String(a.hex).replace(/^~/, '').toLowerCase(), cs: (a.flight || '').trim(), reg: a.r || '', type: a.t || '', desc: a.desc || '',
      lat: a.lat, lon: a.lon, alt: a.alt_baro === 'ground' ? 0 : (typeof a.alt_baro === 'number' ? a.alt_baro : a.alt_geom ?? null),
      ground: a.alt_baro === 'ground', gs: a.gs ?? null, trk: a.track ?? a.true_heading ?? a.mag_heading ?? null,
      vs: a.baro_rate ?? a.geom_rate ?? 0, cat: a.category || '', fix: now - (a.seen_pos || 0) * 1000,
    }));
  }

  async function pollLive() {
    const s = SS.settings.flight, apt = F.airport();
    // centre the query between you and the airport so both ends of the approach are covered
    const cla = (s.lat + apt.lat) / 2, clo = (s.lon + apt.lon) / 2;
    const r = Math.min(60, Math.max(10, Math.round(s.radius + G.dist(s.lat, s.lon, apt.lat, apt.lon) / 2)));
    for (let tries = 0; tries < PROVIDERS.length; tries++) {
      const p = PROVIDERS[provIdx];
      try {
        const d = await U.fetchJSON(p.url(cla, clo, r), { timeout: 9000, cache: 'no-store' });
        const list = normalize(d);
        liveFails = 0;
        merge(list, false);
        F.status = { mode: 'live', source: p.id, home: p.home, at: Date.now(), count: list.length, msg: '' };
        return true;
      } catch (e) { provIdx = (provIdx + 1) % PROVIDERS.length; }
    }
    liveFails++;
    return false;
  }

  const byHex = new Map();
  function merge(list, sim) {
    const seen = new Set();
    for (const a of list) {
      seen.add(a.hex);
      let o = byHex.get(a.hex);
      if (!o) { o = { hex: a.hex, trail: [], info: null }; byHex.set(a.hex, o); }
      Object.assign(o, a, { sim });
      o.trail.push([a.lat, a.lon]); if (o.trail.length > 14) o.trail.shift();
    }
    for (const [hex, o] of byHex) if (!seen.has(hex) && o.sim === sim) byHex.delete(hex);
    if (!sim) for (const [hex, o] of byHex) if (o.sim) byHex.delete(hex);
    F.list = Array.from(byHex.values());
  }

  // Dead-reckon between updates so the radar moves smoothly.
  F.pos = (a, now = Date.now()) => {
    if (a.sim) return simPos(a, now);
    const dt = U.clamp((now - a.fix) / 1000, 0, 25);
    if (!a.gs || a.trk == null || a.ground) return { lat: a.lat, lon: a.lon, alt: a.alt, gs: a.gs, trk: a.trk, vs: a.vs };
    const [la, lo] = G.dest(a.lat, a.lon, a.trk, a.gs * dt / 3600);
    return { lat: la, lon: lo, alt: a.alt != null ? Math.max(0, a.alt + (a.vs || 0) * dt / 60) : null, gs: a.gs, trk: a.trk, vs: a.vs };
  };

  /* ── Simulation (shown with a SIMULATED label, never passed off as live) ── */
  const SIM = [
    ['UAL', 'NRT', 'B789'], ['UAL', 'LHR', 'B77W'], ['UAL', 'EWR', 'B772'], ['UAL', 'ORD', 'B39M'], ['UAL', 'DEN', 'A320'], ['UAL', 'HNL', 'B772'], ['UAL', 'IAD', 'B78X'], ['UAL', 'SIN', 'B789'],
    ['SKW', 'PSP', 'E75L'], ['ASA', 'SEA', 'B39M'], ['QXE', 'PDX', 'E75L'], ['SWA', 'LAS', 'B38M'], ['SWA', 'SAN', 'B737'], ['DAL', 'ATL', 'A321'], ['DAL', 'SLC', 'A20N'], ['AAL', 'DFW', 'B738'], ['AAL', 'PHX', 'A321'],
    ['JBU', 'JFK', 'A21N'], ['JBU', 'BOS', 'A320'], ['HAL', 'HNL', 'A332'], ['BAW', 'LHR', 'A388'], ['UAE', 'DXB', 'A388'], ['SIA', 'SIN', 'A359'], ['CPA', 'HKG', 'A35K'], ['EVA', 'TPE', 'B77W'],
    ['KAL', 'ICN', 'B748'], ['ANA', 'HND', 'B789'], ['JAL', 'HND', 'B788'], ['QFA', 'SYD', 'B789'], ['ANZ', 'AKL', 'B789'], ['AFR', 'CDG', 'B77W'], ['DLH', 'FRA', 'B748'], ['ACA', 'YVR', 'BCS3'], ['AMX', 'MEX', 'B38M'], ['POE', 'YYZ', 'E295'], ['AIC', 'DEL', 'B77L'],
  ];
  let simFlights = [], simSeq = 0, lastSpawn = 0;
  const KT = { far: 250, join: 210, final: 150 };

  function simRoute(originCode) {
    const T = F.RWY28, back = (T.crs + 180) % 360, apt = F.airport();
    const o = AP[originCode] || AP.LAX;
    const brg = G.bearing(apt.lat, apt.lon, o[1], o[2]);
    const fix = G.dest(T.lat, T.lon, back, 14);            // ~4,400 ft on a 3° glide path
    const entry = G.dest(apt.lat, apt.lon, brg, 42);
    const pts = [{ p: entry, alt: 11000, kt: KT.far }];
    if (brg > 200 || brg < 20) pts.push({ p: G.dest(apt.lat, apt.lon, 55, 16), alt: 7000, kt: KT.join }); // swing round over the bay
    pts.push({ p: G.dest(T.lat, T.lon, back, 24), alt: 6500, kt: KT.join });
    pts.push({ p: fix, alt: 4400, kt: KT.final });
    pts.push({ p: [T.lat, T.lon], alt: 20, kt: 140 });
    let tsum = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], d = G.dist(a.p[0], a.p[1], b.p[0], b.p[1]);
      const kt = (a.kt + b.kt) / 2; pts[i].t = tsum += d / kt * 3600; pts[i].d = d;
    }
    pts[0].t = 0;
    return pts;
  }
  function simPos(a, now) {
    if (a.over) {
      const t = (now - a.t0) / 1000, d = a.gs * t / 3600;
      const [la, lo] = G.dest(a.start[0], a.start[1], a.trk, d);
      return { lat: la, lon: lo, alt: a.alt, gs: a.gs, trk: a.trk, vs: 0 };
    }
    const t = (now - a.t0) / 1000, pts = a.path;
    if (t >= pts[pts.length - 1].t) { const L = pts[pts.length - 1]; return { lat: L.p[0], lon: L.p[1], alt: 0, gs: 0, trk: F.RWY28.crs, vs: 0, landed: true }; }
    let i = 1; while (pts[i].t < t) i++;
    const A = pts[i - 1], B = pts[i], f = (t - A.t) / (B.t - A.t);
    return {
      lat: U.lerp(A.p[0], B.p[0], f), lon: U.lerp(A.p[1], B.p[1], f), alt: Math.round(U.lerp(A.alt, B.alt, f)),
      gs: Math.round(U.lerp(A.kt, B.kt, f)), trk: G.bearing(A.p[0], A.p[1], B.p[0], B.p[1]),
      vs: -Math.round((A.alt - B.alt) / Math.max(1, (B.t - A.t)) * 60),
    };
  }
  function spawnSim(now, progress = 0) {
    const [al, org, type] = U.pick(SIM);
    const num = al === 'SWA' ? U.randInt(1000, 4999) : al === 'UAL' && /NRT|SIN|LHR/.test(org) ? U.pick([1, 2, 837, 838, 901, 931, 29]) : U.randInt(10, 2999);
    const path = simRoute(org);
    const total = path[path.length - 1].t * 1000;
    simFlights.push({
      hex: 'sim' + (++simSeq).toString(16).padStart(4, '0'), cs: al + num, type, reg: '', sim: true, t0: now - total * progress, path,
      info: { route: { origin: { iata: org, city: AP[org][0] }, dest: { iata: 'SFO', city: 'San Francisco' }, airline: AL[al][0], airlineIata: AL[al][1] } },
    });
  }
  function spawnOverflight(now) {
    const s = SS.settings.flight, trk = U.rand(0, 360), start = G.dest(s.lat, s.lon, (trk + 180) % 360, 30);
    const [al, org, type] = U.pick(SIM);
    simFlights.push({ hex: 'sim' + (++simSeq).toString(16).padStart(4, '0'), cs: al + U.randInt(100, 2999), type, sim: true, over: true, t0: now, start, trk, gs: U.randInt(420, 500), alt: U.pick([31000, 33000, 35000, 37000, 39000]), info: { route: { origin: { iata: org, city: AP[org][0] }, dest: null, airline: AL[al][0], airlineIata: AL[al][1] } } });
  }
  function stepSim() {
    const now = Date.now();
    if (!simFlights.length) { [0.82, 0.55, 0.3, 0.08].forEach(p => spawnSim(now, p)); spawnOverflight(now); lastSpawn = now; }
    simFlights = simFlights.filter(a => {
      const p = simPos(a, now);
      if (a.over) return G.dist(SS.settings.flight.lat, SS.settings.flight.lon, p.lat, p.lon) < 36;
      return !p.landed || now - a.t0 < a.path[a.path.length - 1].t * 1000 + 8000;
    });
    if (now - lastSpawn > U.rand(100, 170) * 1000) { spawnSim(now, 0); lastSpawn = now; if (Math.random() < 0.3) spawnOverflight(now); }
    const list = simFlights.map(a => { const p = simPos(a, now); return Object.assign(a, { lat: p.lat, lon: p.lon, alt: p.alt, gs: p.gs, trk: p.trk, vs: p.vs, fix: now }); });
    for (const a of list) { let o = byHex.get(a.hex); if (!o) byHex.set(a.hex, a); }
    for (const [hex, o] of byHex) if (o.sim && !list.includes(o)) byHex.delete(hex);
    for (const o of byHex.values()) if (o.sim) { o.trail = o.trail || []; o.trail.push([o.lat, o.lon]); if (o.trail.length > 14) o.trail.shift(); }
    F.list = Array.from(byHex.values()).filter(o => o.sim);
    F.status = { mode: 'sim', source: 'simulation', at: now, count: F.list.length, msg: SS.env.cspBlocked ? 'Live flight data is blocked in this preview.' : (SS.server.available ? 'The live feeds aren\'t answering right now.' : 'This browser can\'t reach the live feeds directly. Add the free Cloudflare Worker (Settings → Sync & devices) for real flights.') };
  }

  async function tick() {
    clearTimeout(timer);
    const s = SS.settings.flight;
    if (!s.enabled || s.mode === 'off') { F.list = []; byHex.clear(); F.status = { mode: 'off' }; F.featured = null; SS.emit('flights'); timer = setTimeout(tick, 15000); return; }
    let live = false;
    if (s.mode !== 'sim' && !SS.env.cspBlocked) {
      // in auto mode, once we've fallen back to sim, only retry live once a minute
      const inSim = F.status.mode === 'sim';
      if (!inSim || Date.now() - lastLiveTry > 60000 || s.mode === 'live') { lastLiveTry = Date.now(); live = await pollLive(); }
    }
    if (!live) {
      if (s.mode === 'live') { F.status = { mode: 'down', source: '', at: Date.now(), count: 0, msg: 'Live feeds unreachable right now.' }; F.list = []; }
      else stepSim();
    } else simFlights = [];
    analyze();
    SS.emit('flights');
    timer = setTimeout(tick, live ? 10000 : 2000);
  }
  F.start = () => { tick(); setInterval(() => { analyze(); SS.emit('flights-tick'); }, 1000); };
  F.restart = () => { simFlights = []; byHex.clear(); F.list = []; liveFails = 0; lastLiveTry = 0; tick(); };

  /* ── Analysis: who's inbound, who's next, when do they pass you ── */
  function analyze() {
    const s = SS.settings.flight, apt = F.airport(), now = Date.now();
    for (const a of F.list) {
      const p = F.pos(a, now);
      a.cur = p;
      a.dObs = G.dist(s.lat, s.lon, p.lat, p.lon);
      a.dApt = G.dist(apt.lat, apt.lon, p.lat, p.lon);
      const toApt = G.bearing(p.lat, p.lon, apt.lat, apt.lon);
      const alt = p.alt ?? 99999;
      const routeDest = a.info && a.info.route && a.info.route.dest && a.info.route.dest.iata;
      let inbound = !a.ground && p.trk != null && alt < 13000 && a.dApt < 45 && (p.vs || 0) <= 400 && Math.abs(G.angDiff(p.trk, toApt)) < 55;
      if (routeDest) inbound = routeDest === apt.code && alt < 18000 && a.dApt < 70 && !a.ground;
      if (a.over) inbound = false;
      a.inbound = inbound && alt > 0;
      const [ex, ny] = G.enu(s.lat, s.lon, p.lat, p.lon);
      const v = (p.gs || 0) / 3600, tr = (p.trk || 0) * Math.PI / 180, vx = v * Math.sin(tr), vy = v * Math.cos(tr), vv = vx * vx + vy * vy;
      a.cpaT = vv > 0 ? -(ex * vx + ny * vy) / vv : Infinity;
      a.cpaD = a.cpaT > 0 ? Math.hypot(ex + vx * a.cpaT, ny + vy * a.cpaT) : a.dObs;
      a.eta = p.gs > 40 ? (a.dApt / p.gs) * 3600 * 1.08 : null;
      if (a.inbound && !a.info && !a.sim) enrich(a);
    }
    const arrivals = F.list.filter(a => a.inbound && a.eta != null).sort((x, y) => x.eta - y.eta);
    let f = F.featured && F.list.find(a => a.hex === F.featured.hex && a.inbound);
    if (!f || (arrivals[0] && arrivals[0] !== f && arrivals[0].eta < f.eta - 25)) f = arrivals[0] || null;
    if (f !== F.featured) { F.featured = f; if (f) SS.emit('featured', f); }
    if (f) remember(f);
  }

  function remember(a) {
    const d = F.describe(a);
    const rec = { hex: a.hex, cs: a.cs, flightNo: d.flightNo, type: a.type, typeName: d.typeName, kind: d.kind, origin: d.origin, airline: d.airline, photo: d.photo, sim: !!a.sim, at: Date.now() };
    F.lastSeen = rec;
    U.store.set('lastFlight', rec);
    if (!F.history.length || F.history[0].hex !== a.hex) {
      F.history = [rec, ...F.history.filter(h => h.hex !== a.hex)].slice(0, 40);
      U.store.set('flightHistory', F.history);
    } else F.history[0] = rec;
  }

  /* ── Enrichment: route (adsbdb), photo (Planespotters) ── */
  const cache = new Map(Object.entries(U.store.get('acCache', {})));
  const saveCache = U.debounce(() => { const o = {}; Array.from(cache.entries()).slice(-250).forEach(([k, v]) => (o[k] = v)); U.store.set('acCache', o); }, 3000);
  const pending = new Set();
  async function enrich(a) {
    const key = a.hex + '|' + (a.cs || '');
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < 12 * 3600e3) { a.info = hit; return; }
    if (pending.has(key)) return;
    pending.add(key);
    const info = { t: Date.now(), route: null, aircraft: null, photo: null };
    const ap = o => o && { iata: o.iata_code, icao: o.icao_code, name: o.name, city: o.municipality, country: o.country_name, lat: o.latitude, lon: o.longitude };
    try {
      const r = await U.fetchRaw(`https://api.adsbdb.com/v0/aircraft/${a.hex}${a.cs ? '?callsign=' + encodeURIComponent(a.cs) : ''}`, { timeout: 8000 });
      if (r.ok) {
        const j = await r.json(), ac = j.response && j.response.aircraft, fr = j.response && j.response.flightroute;
        if (ac) info.aircraft = { type: ac.type, icao: ac.icao_type, maker: ac.manufacturer, reg: ac.registration, owner: ac.registered_owner, country: ac.registered_owner_country_name, photo: ac.url_photo_thumbnail, photoFull: ac.url_photo };
        if (fr) info.route = { airline: fr.airline && fr.airline.name, airlineIata: fr.airline && fr.airline.iata, flightIata: fr.callsign_iata, origin: ap(fr.origin), dest: ap(fr.destination) };
      }
      if (!info.route && a.cs) {
        const r2 = await U.fetchRaw(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(a.cs)}`, { timeout: 8000 });
        if (r2.ok) { const j2 = await r2.json(), fr = j2.response && j2.response.flightroute; if (fr) info.route = { airline: fr.airline && fr.airline.name, airlineIata: fr.airline && fr.airline.iata, flightIata: fr.callsign_iata, origin: ap(fr.origin), dest: ap(fr.destination) }; }
      }
    } catch (e) { /* route unknown */ }
    try {
      const j = await U.fetchJSON(`https://api.planespotters.net/pub/photos/hex/${a.hex}`, { timeout: 8000 });
      const ph = j.photos && j.photos[0];
      if (ph) info.photo = { src: (ph.thumbnail_large || ph.thumbnail || {}).src, link: ph.link, by: ph.photographer, site: 'Planespotters.net' };
    } catch (e) { /* no photo */ }
    if (!info.photo && info.aircraft && (info.aircraft.photoFull || info.aircraft.photo)) info.photo = { src: info.aircraft.photoFull || info.aircraft.photo, link: 'https://www.airport-data.com/', by: 'airport-data.com', site: 'airport-data.com' };
    a.info = info; cache.set(key, info); saveCache(); pending.delete(key);
    SS.emit('flights');
  }

  F.enrich = a => { if (a && !a.sim && !a.info) enrich(a); };

  /* ── Presentation ── */
  F.describe = function (a) {
    const info = a.info || {}, route = info.route || {}, acf = info.aircraft || {};
    const m = /^([A-Z]{3})(\d{1,4}[A-Z]?)$/.exec(a.cs || '');
    const al = m && AL[m[1]];
    const flightNo = route.flightIata ? route.flightIata.replace(/^([A-Z0-9]{2})(\d)/, '$1 $2') : (al && al[1] ? `${al[1]} ${m[2]}` : (a.cs || a.reg || a.hex.toUpperCase()));
    const code = a.type || acf.icao || '';
    const t = TY[code];
    const kind = (t && t[1]) || KIND_BY_CAT[a.cat] || 'narrow';
    const typeName = (t && t[0]) || [acf.maker, acf.type].filter(Boolean).join(' ') || a.desc || code || 'Aircraft';
    const seats = t && t[3] ? (t[2] === t[3] ? `${t[2]} seats` : `${t[2]}–${t[3]} seats`) : (kind === 'wide' && code === 'MD11' ? 'freighter' : '');
    let origin = route.origin;
    if (origin && !origin.city && AP[origin.iata]) origin.city = AP[origin.iata][0];
    let distFlown = null;
    if (origin && origin.lat == null && AP[origin.iata]) { origin = { ...origin, lat: AP[origin.iata][1], lon: AP[origin.iata][2] }; }
    if (origin && origin.lat != null) { const apt = F.airport(); distFlown = G.dist(origin.lat, origin.lon, apt.lat, apt.lon) * 1.15078; }
    const rp = F.realPhoto(a);
    return {
      flightNo, airline: route.airline || (al && al[0]) || acf.owner || '', origin, dest: route.dest, typeName, kind, seats,
      fact: (t && t[4]) || '', reg: acf.reg || a.reg || '', owner: acf.owner || '', photo: rp.src ? rp : null, photoPending: !!rp.pending, distFlownMi: distFlown, sim: !!a.sim,
    };
  };

  // Planes for the game: the featured one first, then other arrivals, then recent history.
  F.gamePool = function () {
    const out = [], seen = new Set();
    const add = (cs, type, origin, flightNo, photo, sim) => { if (!cs || seen.has(cs)) return; seen.add(cs); out.push({ cs, type, origin, flightNo, photo, sim }); };
    const f = F.featured;
    if (f) { const d = F.describe(f); add(f.cs || d.flightNo, f.type, d.origin, d.flightNo, d.photo, f.sim); }
    else if (F.lastSeen) add(F.lastSeen.cs || F.lastSeen.flightNo, F.lastSeen.type, F.lastSeen.origin, F.lastSeen.flightNo, F.lastSeen.photo, F.lastSeen.sim);
    F.list.filter(a => a.inbound).sort((x, y) => (x.eta || 1e9) - (y.eta || 1e9)).forEach(a => { const d = F.describe(a); add(a.cs || d.flightNo, a.type, d.origin, d.flightNo, d.photo, a.sim); });
    F.list.forEach(a => { const d = F.describe(a); add(a.cs, a.type, d.origin, d.flightNo, d.photo, a.sim); });
    F.history.forEach(h => add(h.cs || h.flightNo, h.type, h.origin, h.flightNo, h.photo, h.sim));
    return out;
  };
  F.SIM = SIM;
})();
