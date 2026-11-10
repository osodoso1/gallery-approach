/* Landmarks: famous places near you (or anywhere you pick), their photos, and the live weather at each one.
   - A built-in list of landmarks around the world, grouped by city / state / country.
   - Somewhere new? Wikipedia's "what's near here" search finds the best-known places around you and adds them.
   - Photos: Wikimedia Commons (quality images first). Weather: Open-Meteo, at the landmark itself. */
(function () {
  'use strict';
  const U = SS.u, G = U.geo;
  const LM = (SS.landmarks = { ready: false, where: null, list: [], widened: '', photos: {}, wx: {}, seq: [], pos: 0, jump: null, status: '' });

  const CN = { US: 'United States', CA: 'Canada', MX: 'Mexico', BR: 'Brazil', PE: 'Peru', AR: 'Argentina', CL: 'Chile', BO: 'Bolivia', GB: 'United Kingdom', IE: 'Ireland', FR: 'France', IT: 'Italy', ES: 'Spain', PT: 'Portugal',
    DE: 'Germany', NL: 'Netherlands', BE: 'Belgium', CH: 'Switzerland', AT: 'Austria', CZ: 'Czechia', HU: 'Hungary', GR: 'Greece', TR: 'Türkiye', DK: 'Denmark', SE: 'Sweden', NO: 'Norway', FI: 'Finland', IS: 'Iceland', RU: 'Russia', PL: 'Poland', HR: 'Croatia',
    AE: 'United Arab Emirates', EG: 'Egypt', JO: 'Jordan', MA: 'Morocco', ZA: 'South Africa', TZ: 'Tanzania', ZW: 'Zimbabwe', JP: 'Japan', KR: 'South Korea', CN: 'China', HK: 'Hong Kong', TW: 'Taiwan', SG: 'Singapore', MY: 'Malaysia', TH: 'Thailand', VN: 'Vietnam',
    KH: 'Cambodia', ID: 'Indonesia', PH: 'Philippines', IN: 'India', NP: 'Nepal', LK: 'Sri Lanka', UZ: 'Uzbekistan', AU: 'Australia', NZ: 'New Zealand', PF: 'French Polynesia' };
  LM.countryName = cc => CN[cc] || cc || '';

  /* "#CC|State or region|City or area|lat|lon" starts a place; then one landmark per line: "Name;lat;lon;search words (optional)".
     The first landmark of a place is its headliner. */
  const RAW = `
#US|California|San Francisco|37.7749|-122.4194
Golden Gate Bridge;37.8199;-122.4783
Coit Tower;37.8024;-122.4058
Alcatraz Island;37.8267;-122.4230
Bay Bridge;37.7983;-122.3778;"San Francisco–Oakland Bay Bridge"
Painted Ladies;37.7763;-122.4328;"Painted Ladies" San Francisco
Palace of Fine Arts;37.8029;-122.4484
Transamerica Pyramid;37.7952;-122.4028
Lombard Street;37.8021;-122.4187;"Lombard Street" San Francisco
Ferry Building;37.7955;-122.3937;"San Francisco Ferry Building"
Sutro Tower;37.7552;-122.4528
Twin Peaks;37.7544;-122.4477;"Twin Peaks" San Francisco view
Muir Woods;37.8970;-122.5811;"Muir Woods National Monument"
Point Reyes Lighthouse;37.9955;-123.0232
Hoover Tower;37.4275;-122.1670;"Hoover Tower" Stanford
#US|California|Yosemite|37.7456|-119.5936
Half Dome;37.7459;-119.5332
El Capitan;37.7340;-119.6377;"El Capitan" Yosemite
Yosemite Falls;37.7566;-119.5969
Tunnel View;37.7158;-119.6773;"Tunnel View" Yosemite
#US|California|Big Sur|36.2704|-121.8081
Bixby Bridge;36.3715;-121.9017;"Bixby Creek Bridge"
McWay Falls;36.1578;-121.6722
#US|California|Lake Tahoe|39.0968|-120.0324
Emerald Bay;38.9542;-120.1104;"Emerald Bay" Lake Tahoe
#US|California|Los Angeles|34.0522|-118.2437
Hollywood Sign;34.1341;-118.3215
Griffith Observatory;34.1184;-118.3004
Santa Monica Pier;34.0086;-118.4986
Walt Disney Concert Hall;34.0553;-118.2498
Venice Beach;33.9850;-118.4695;"Venice Beach" Los Angeles
Downtown Los Angeles;34.0500;-118.2500;Los Angeles skyline downtown
#US|California|San Diego|32.7157|-117.1611
Balboa Park;32.7341;-117.1446;"Balboa Park" San Diego
Hotel del Coronado;32.6807;-117.1784
La Jolla Cove;32.8504;-117.2729
Coronado Bridge;32.6893;-117.1534;"San Diego–Coronado Bridge"
#US|New York|New York|40.7128|-74.0060
Statue of Liberty;40.6892;-74.0445
Brooklyn Bridge;40.7061;-73.9969
Empire State Building;40.7484;-73.9857
Times Square;40.7580;-73.9855
Central Park;40.7829;-73.9654;"Central Park" New York
One World Trade Center;40.7127;-74.0134
Chrysler Building;40.7516;-73.9755
Flatiron Building;40.7411;-73.9897
#US|New York|Niagara Falls|43.0828|-79.0742
Niagara Falls;43.0828;-79.0742;"Niagara Falls" waterfall
#US|Illinois|Chicago|41.8781|-87.6298
Cloud Gate;41.8827;-87.6233;"Cloud Gate" Chicago
Willis Tower;41.8789;-87.6359
Navy Pier;41.8917;-87.6086
Chicago River;41.8880;-87.6270;Chicago River skyline
Buckingham Fountain;41.8758;-87.6189
#US|Washington|Seattle|47.6062|-122.3321
Space Needle;47.6205;-122.3493
Pike Place Market;47.6097;-122.3422
Mount Rainier;46.8523;-121.7603
Seattle Great Wheel;47.6061;-122.3425
Kerry Park;47.6295;-122.3599;Seattle skyline "Kerry Park"
#US|District of Columbia|Washington|38.9072|-77.0369
Lincoln Memorial;38.8893;-77.0502
Washington Monument;38.8895;-77.0353
United States Capitol;38.8899;-77.0091
White House;38.8977;-77.0365
Jefferson Memorial;38.8814;-77.0365
#US|Massachusetts|Boston|42.3601|-71.0589
Zakim Bridge;42.3689;-71.0631;"Zakim Bridge" Boston
Fenway Park;42.3467;-71.0972
Boston Public Garden;42.3541;-71.0704
Acorn Street;42.3576;-71.0689;"Acorn Street" Boston
Massachusetts State House;42.3588;-71.0638
#US|Nevada|Las Vegas|36.1699|-115.1398
Las Vegas Strip;36.1147;-115.1728
Welcome to Las Vegas Sign;36.0820;-115.1728;"Welcome to Fabulous Las Vegas"
Hoover Dam;36.0161;-114.7377
Red Rock Canyon;36.1350;-115.4270;"Red Rock Canyon" Nevada
#US|Arizona|Grand Canyon|36.1070|-112.1130
Grand Canyon;36.1070;-112.1130;"Grand Canyon" South Rim
Horseshoe Bend;36.8791;-111.5104;"Horseshoe Bend" Arizona
Antelope Canyon;36.8619;-111.3743
Monument Valley;36.9980;-110.0985
Cathedral Rock;34.8200;-111.7932;"Cathedral Rock" Sedona
#US|Florida|Miami|25.7617|-80.1918
South Beach;25.7826;-80.1341;"South Beach" Miami
Ocean Drive;25.7800;-80.1300;"Ocean Drive" Miami Beach
Miami Skyline;25.7700;-80.1900;Miami skyline Brickell
#US|Hawaii|Honolulu|21.3069|-157.8583
Diamond Head;21.2620;-157.8060;"Diamond Head" Hawaii
Waikiki Beach;21.2766;-157.8278
Hanauma Bay;21.2690;-157.6938
Nā Pali Coast;22.1700;-159.6400;"Na Pali Coast"
#US|Louisiana|New Orleans|29.9511|-90.0715
St. Louis Cathedral;29.9580;-90.0637;"St. Louis Cathedral" New Orleans
French Quarter;29.9584;-90.0644;"French Quarter" New Orleans
#US|Colorado|Denver|39.7392|-104.9903
Red Rocks Amphitheatre;39.6654;-105.2057
Garden of the Gods;38.8784;-104.8698
Maroon Bells;39.0708;-106.9890
#US|Wyoming|Yellowstone|44.4280|-110.5885
Old Faithful;44.4605;-110.8281
Grand Prismatic Spring;44.5251;-110.8382
Grand Teton;43.7410;-110.8024
Devils Tower;44.5902;-104.7146
#US|Utah|Moab|38.5733|-109.5498
Delicate Arch;38.7436;-109.4993
Zion Canyon;37.2982;-113.0263;"Zion National Park"
Bryce Canyon;37.5930;-112.1871
Salt Lake Temple;40.7704;-111.8919
#US|Oregon|Portland|45.5152|-122.6784
Multnomah Falls;45.5762;-122.1158
Mount Hood;45.3736;-121.6960
St. Johns Bridge;45.5851;-122.7647
Crater Lake;42.9446;-122.1090
Haystack Rock;45.8841;-123.9686;"Haystack Rock" Cannon Beach
#US|Pennsylvania|Philadelphia|39.9526|-75.1652
Independence Hall;39.9489;-75.1500
Philadelphia Museum of Art;39.9656;-75.1810
Philadelphia City Hall;39.9524;-75.1636
#US|Texas|Austin|30.2672|-97.7431
Texas State Capitol;30.2747;-97.7404
Pennybacker Bridge;30.3516;-97.7970
The Alamo;29.4260;-98.4861;"Alamo Mission" San Antonio
San Antonio River Walk;29.4230;-98.4890
Reunion Tower;32.7755;-96.8089
#US|Missouri|St. Louis|38.6270|-90.1994
Gateway Arch;38.6247;-90.1848
#US|South Dakota|Black Hills|43.8791|-103.4591
Mount Rushmore;43.8791;-103.4591
#US|Alaska|Denali|63.0692|-151.0070
Denali;63.0692;-151.0070;Denali mountain Alaska
#CA|Ontario|Toronto|43.6532|-79.3832
CN Tower;43.6426;-79.3871
Toronto Skyline;43.6400;-79.3800;Toronto skyline
Casa Loma;43.6780;-79.4094
Horseshoe Falls;43.0773;-79.0752;"Horseshoe Falls" Niagara
#CA|British Columbia|Vancouver|49.2827|-123.1207
Stanley Park;49.3043;-123.1443;"Stanley Park" Vancouver
Lions Gate Bridge;49.3153;-123.1389
Canada Place;49.2888;-123.1111
Capilano Suspension Bridge;49.3429;-123.1149
#CA|Alberta|Banff|51.1784|-115.5708
Lake Louise;51.4168;-116.2200;"Lake Louise" Alberta
Moraine Lake;51.3217;-116.1860
Banff Springs Hotel;51.1644;-115.5619
#CA|Quebec|Montreal|45.5017|-73.5673
Notre-Dame Basilica;45.5045;-73.5561;"Notre-Dame Basilica" Montreal
Mount Royal;45.5048;-73.5878;"Mount Royal" Montreal
Château Frontenac;46.8120;-71.2050
#MX|Mexico City|Mexico City|19.4326|-99.1332
Palacio de Bellas Artes;19.4352;-99.1412
Angel of Independence;19.4270;-99.1677
Zócalo;19.4326;-99.1332;Zócalo Mexico City
Teotihuacan;19.6925;-98.8438
#MX|Yucatán|Yucatán|20.6843|-88.5678
Chichen Itza;20.6843;-88.5678
Tulum;20.2145;-87.4291;Tulum ruins
#BR|Rio de Janeiro|Rio de Janeiro|-22.9068|-43.1729
Christ the Redeemer;-22.9519;-43.2105;"Christ the Redeemer" Rio
Sugarloaf Mountain;-22.9492;-43.1545
Copacabana;-22.9711;-43.1822;Copacabana beach Rio
Iguazu Falls;-25.6953;-54.4367
#PE|Cusco|Cusco|-13.5320|-71.9675
Machu Picchu;-13.1631;-72.5450
Rainbow Mountain;-13.8700;-71.3030;Vinicunca
#AR|Buenos Aires|Buenos Aires|-34.6037|-58.3816
Obelisco;-34.6037;-58.3816;"Obelisco de Buenos Aires"
Casa Rosada;-34.6081;-58.3703
Perito Moreno Glacier;-50.4967;-73.1377
Mount Fitz Roy;-49.2714;-73.0432;"Fitz Roy"
#CL|Magallanes|Patagonia|-50.9423|-73.4068
Torres del Paine;-50.9423;-73.4068
Easter Island Moai;-27.1258;-109.2769;Moai "Ahu Tongariki"
#BO|Potosí|Uyuni|-20.1338|-67.4891
Salar de Uyuni;-20.1338;-67.4891
#GB|England|London|51.5074|-0.1278
Tower Bridge;51.5055;-0.0754
Big Ben;51.5007;-0.1246;"Big Ben"
London Eye;51.5033;-0.1196
St Paul's Cathedral;51.5138;-0.0984;"St Paul's Cathedral" London
Buckingham Palace;51.5014;-0.1419
The Shard;51.5045;-0.0865;"The Shard"
Tower of London;51.5081;-0.0759
Stonehenge;51.1789;-1.8262
#GB|Scotland|Edinburgh|55.9533|-3.1883
Edinburgh Castle;55.9486;-3.1999
Arthur's Seat;55.9441;-3.1618
Forth Bridge;56.0006;-3.3886
Glenfinnan Viaduct;56.8760;-5.4317
Eilean Donan;57.2742;-5.5161
Old Man of Storr;57.5070;-6.1830
#GB|Northern Ireland|Antrim Coast|55.2408|-6.5116
Giant's Causeway;55.2408;-6.5116
#IE|Leinster|Dublin|53.3498|-6.2603
Ha'penny Bridge;53.3461;-6.2631
Trinity College;53.3438;-6.2546;"Trinity College" Dublin
Cliffs of Moher;52.9715;-9.4309
#FR|Île-de-France|Paris|48.8566|2.3522
Eiffel Tower;48.8584;2.2945
Arc de Triomphe;48.8738;2.2950
Notre-Dame de Paris;48.8530;2.3499
Louvre Pyramid;48.8606;2.3376
Sacré-Cœur;48.8867;2.3431;Sacré-Cœur Paris Montmartre
Pont Alexandre III;48.8639;2.3136
Palace of Versailles;48.8049;2.1204
#FR|Normandy|Normandy|48.6361|-1.5115
Mont-Saint-Michel;48.6361;-1.5115
#FR|Auvergne-Rhône-Alpes|Chamonix|45.9237|6.8694
Mont Blanc;45.8326;6.8652;"Mont Blanc" Chamonix
#IT|Lazio|Rome|41.9028|12.4964
Colosseum;41.8902;12.4922
Trevi Fountain;41.9009;12.4833
St. Peter's Basilica;41.9022;12.4539
Pantheon;41.8986;12.4769;Pantheon Rome
Roman Forum;41.8925;12.4853
#IT|Veneto|Venice|45.4408|12.3155
Rialto Bridge;45.4380;12.3359
St Mark's Square;45.4342;12.3388;"Piazza San Marco"
Grand Canal;45.4370;12.3270;"Grand Canal" Venice
#IT|Tuscany|Florence|43.7696|11.2558
Florence Cathedral;43.7731;11.2560
Ponte Vecchio;43.7680;11.2531
Leaning Tower of Pisa;43.7230;10.3966
Manarola;44.1068;9.7290;Manarola "Cinque Terre"
#IT|Lombardy|Milan|45.4642|9.1900
Milan Cathedral;45.4641;9.1919
#IT|Campania|Amalfi Coast|40.6333|14.6029
Positano;40.6281;14.4850
Tre Cime di Lavaredo;46.6187;12.3023
#ES|Catalonia|Barcelona|41.3851|2.1734
Sagrada Família;41.4036;2.1744
Park Güell;41.4145;2.1527
Casa Batlló;41.3917;2.1650
#ES|Community of Madrid|Madrid|40.4168|-3.7038
Royal Palace of Madrid;40.4180;-3.7143
Plaza Mayor;40.4155;-3.7074;"Plaza Mayor" Madrid
Alhambra;37.1760;-3.5881
Plaza de España;37.3772;-5.9869;"Plaza de España" Seville
#PT|Lisbon|Lisbon|38.7223|-9.1393
Belém Tower;38.6916;-9.2160
25 de Abril Bridge;38.6895;-9.1771
Pena Palace;38.7876;-9.3906
Dom Luís I Bridge;41.1400;-8.6094
#DE|Berlin|Berlin|52.5200|13.4050
Brandenburg Gate;52.5163;13.3777
Reichstag;52.5186;13.3762;"Reichstag building"
Berlin TV Tower;52.5208;13.4094;Fernsehturm Berlin
Berlin Cathedral;52.5191;13.4010
#DE|Bavaria|Munich|48.1351|11.5820
Neuschwanstein Castle;47.5576;10.7498
Marienplatz;48.1374;11.5755;Marienplatz Munich
Cologne Cathedral;50.9413;6.9583
Elbphilharmonie;53.5413;9.9841
#NL|North Holland|Amsterdam|52.3676|4.9041
Amsterdam Canals;52.3700;4.8900;Amsterdam canal houses
Rijksmuseum;52.3600;4.8852;Rijksmuseum building
Kinderdijk;51.8830;4.6360;Kinderdijk windmills
Zaanse Schans;52.4740;4.8170
#BE|Brussels|Brussels|50.8503|4.3517
Grand-Place;50.8467;4.3525;"Grand-Place" Brussels
Belfry of Bruges;51.2082;3.2247
#CH|Valais|Swiss Alps|46.0207|7.7491
Matterhorn;45.9763;7.6586
Chapel Bridge;47.0516;8.3075;Kapellbrücke Lucerne
Jungfraujoch;46.5475;7.9851
Lauterbrunnen;46.5935;7.9091
#AT|Vienna|Vienna|48.2082|16.3738
Schönbrunn Palace;48.1845;16.3122
St. Stephen's Cathedral;48.2085;16.3731;Stephansdom Vienna
Hallstatt;47.5622;13.6493
Hohensalzburg Fortress;47.7950;13.0477
#CZ|Prague|Prague|50.0755|14.4378
Charles Bridge;50.0865;14.4114
Prague Castle;50.0909;14.4005
Old Town Square;50.0875;14.4213;Prague "Old Town Square"
#HU|Budapest|Budapest|47.4979|19.0402
Hungarian Parliament;47.5071;19.0457;"Hungarian Parliament Building"
Fisherman's Bastion;47.5021;19.0348
Chain Bridge;47.4990;19.0437;"Széchenyi Chain Bridge"
#GR|Attica|Athens|37.9838|23.7275
Acropolis;37.9715;23.7267;Acropolis Athens Parthenon
Oia, Santorini;36.4618;25.3753;Oia Santorini
Meteora;39.7217;21.6306
#TR|Istanbul|Istanbul|41.0082|28.9784
Hagia Sophia;41.0086;28.9802
Blue Mosque;41.0054;28.9768;"Sultan Ahmed Mosque"
Galata Tower;41.0256;28.9741
Bosphorus Bridge;41.0451;29.0340
Cappadocia;38.6431;34.8289;Cappadocia Göreme balloons
Pamukkale;37.9204;29.1187
#DK|Capital Region|Copenhagen|55.6761|12.5683
Nyhavn;55.6798;12.5914
#SE|Stockholm|Stockholm|59.3293|18.0686
Gamla stan;59.3251;18.0711;"Gamla stan" Stockholm
Stockholm City Hall;59.3275;18.0543
#NO|Vestland|Norwegian Fjords|60.3913|5.3221
Bryggen;60.3975;5.3245;Bryggen Bergen
Geirangerfjord;62.1049;7.0942
Preikestolen;58.9864;6.1904
Reine, Lofoten;67.9324;13.0890;Reine Lofoten
#FI|Uusimaa|Helsinki|60.1699|24.9384
Helsinki Cathedral;60.1704;24.9522
#IS|Capital Region|Reykjavík|64.1466|-21.9426
Hallgrímskirkja;64.1417;-21.9266
Skógafoss;63.5321;-19.5114
Kirkjufell;64.9417;-23.3069
Jökulsárlón;64.0784;-16.2306
Gullfoss;64.3271;-20.1199
#RU|Moscow|Moscow|55.7558|37.6173
Saint Basil's Cathedral;55.7525;37.6231
Moscow Kremlin;55.7520;37.6175
Church of the Savior on Blood;59.9401;30.3289
Winter Palace;59.9404;30.3138
#PL|Lesser Poland|Kraków|50.0647|19.9450
Wawel Castle;50.0540;19.9354
#HR|Dubrovnik-Neretva|Dubrovnik|42.6507|18.0944
Dubrovnik Old Town;42.6407;18.1077;Dubrovnik old town walls
Plitvice Lakes;44.8654;15.5820
#AE|Dubai|Dubai|25.2048|55.2708
Burj Khalifa;25.1972;55.2744
Burj Al Arab;25.1412;55.1853
Palm Jumeirah;25.1124;55.1390
Sheikh Zayed Grand Mosque;24.4128;54.4750
#EG|Giza|Cairo|30.0444|31.2357
Pyramids of Giza;29.9792;31.1342;"Giza pyramid complex"
Great Sphinx;29.9753;31.1376;"Great Sphinx of Giza"
Karnak;25.7188;32.6573;Karnak temple
Abu Simbel;22.3372;31.6258
#JO|Ma'an|Petra|30.3285|35.4444
Petra;30.3285;35.4444;Petra "Al-Khazneh"
#MA|Marrakesh-Safi|Marrakech|31.6295|-7.9811
Koutoubia Mosque;31.6237;-7.9936
Chefchaouen;35.1688;-5.2636
Hassan II Mosque;33.6084;-7.6326
#ZA|Western Cape|Cape Town|-33.9249|18.4241
Table Mountain;-33.9628;18.4098
Cape of Good Hope;-34.3568;18.4740
Bo-Kaap;-33.9200;18.4150
#TZ|Kilimanjaro|East Africa|-3.0674|37.3556
Mount Kilimanjaro;-3.0674;37.3556
Serengeti;-2.3333;34.8333;Serengeti landscape
#ZW|Matabeleland North|Victoria Falls|-17.9243|25.8572
Victoria Falls;-17.9243;25.8572;"Victoria Falls" waterfall
#JP|Tokyo|Tokyo|35.6762|139.6503
Tokyo Tower;35.6586;139.7454
Shibuya Crossing;35.6595;139.7005
Sensō-ji;35.7148;139.7967
Tokyo Skytree;35.7101;139.8107
Rainbow Bridge;35.6365;139.7634;"Rainbow Bridge" Tokyo
Meiji Shrine;35.6764;139.6993
Shinjuku;35.6938;139.7034;Shinjuku skyline
#JP|Yamanashi|Mount Fuji|35.3606|138.7274
Mount Fuji;35.3606;138.7274
Chureito Pagoda;35.5012;138.8014
#JP|Kyoto|Kyoto|35.0116|135.7681
Fushimi Inari Shrine;34.9671;135.7727;"Fushimi Inari-taisha" torii
Kinkaku-ji;35.0394;135.7292
Kiyomizu-dera;34.9949;135.7850
Arashiyama Bamboo Grove;35.0170;135.6713
Tōdai-ji;34.6890;135.8398
#JP|Osaka|Osaka|34.6937|135.5023
Osaka Castle;34.6873;135.5262
Dōtonbori;34.6687;135.5013
Himeji Castle;34.8394;134.6939
Itsukushima Shrine;34.2960;132.3198
#KR|Seoul|Seoul|37.5665|126.9780
Gyeongbokgung;37.5796;126.9770
N Seoul Tower;37.5512;126.9882
Bukchon Hanok Village;37.5826;126.9830
Lotte World Tower;37.5126;127.1026
#CN|Beijing|Beijing|39.9042|116.4074
Great Wall of China;40.4319;116.5704;"Great Wall of China" Mutianyu
Forbidden City;39.9163;116.3972
Temple of Heaven;39.8822;116.4066
#CN|Shanghai|Shanghai|31.2304|121.4737
The Bund;31.2400;121.4900;"The Bund" Shanghai
Oriental Pearl Tower;31.2397;121.4998
Shanghai Tower;31.2335;121.5055
#CN|Guangxi|Guilin|25.2736|110.2900
Li River;24.7770;110.4900;"Li River" Guilin
Zhangjiajie;29.3450;110.4800;Zhangjiajie National Forest Park
Terracotta Army;34.3848;109.2785
Potala Palace;29.6578;91.1170
#HK|Hong Kong|Hong Kong|22.3193|114.1694
Victoria Harbour;22.2930;114.1700
Victoria Peak;22.2759;114.1455;"Victoria Peak" Hong Kong view
Tian Tan Buddha;22.2540;113.9050
#TW|Taipei|Taipei|25.0330|121.5654
Taipei 101;25.0340;121.5645
Jiufen;25.1090;121.8440
#SG|Singapore|Singapore|1.3521|103.8198
Marina Bay Sands;1.2834;103.8607
Gardens by the Bay;1.2816;103.8636
Merlion;1.2868;103.8545;Merlion Park Singapore
#MY|Kuala Lumpur|Kuala Lumpur|3.1390|101.6869
Petronas Towers;3.1579;101.7116
Batu Caves;3.2379;101.6840
#TH|Bangkok|Bangkok|13.7563|100.5018
Wat Arun;13.7437;100.4889
Grand Palace;13.7500;100.4913;"Grand Palace" Bangkok
Phi Phi Islands;7.7407;98.7784
Doi Suthep;18.8050;98.9216;"Wat Phra That Doi Suthep"
#VN|Quảng Ninh|Vietnam|20.9101|107.1839
Ha Long Bay;20.9101;107.1839
Hoi An;15.8801;108.3380;"Hoi An" ancient town
Golden Bridge;15.9950;107.9880;"Golden Bridge" Bà Nà Hills
#KH|Siem Reap|Siem Reap|13.3633|103.8564
Angkor Wat;13.4125;103.8670
#ID|Bali|Indonesia|-8.4095|115.1889
Ulun Danu Bratan Temple;-8.2752;115.1668;"Pura Ulun Danu Bratan"
Tanah Lot;-8.6212;115.0868
Borobudur;-7.6079;110.2038
Mount Bromo;-7.9425;112.9530
#PH|Metro Manila|Philippines|14.5995|120.9842
Rizal Park;14.5826;120.9787;"Rizal Park" Manila
Mayon Volcano;13.2548;123.6861
Chocolate Hills;9.8297;124.1397
El Nido;11.1784;119.3916;"El Nido" Palawan
Banaue Rice Terraces;16.9244;121.0570
#IN|Uttar Pradesh|Agra|27.1767|78.0081
Taj Mahal;27.1751;78.0421
Varanasi Ghats;25.3109;83.0107;Varanasi ghats Ganges
#IN|Delhi|Delhi|28.6139|77.2090
India Gate;28.6129;77.2295
Red Fort;28.6562;77.2410;"Red Fort" Delhi
Qutub Minar;28.5245;77.1855
Hawa Mahal;26.9239;75.8267
Golden Temple;31.6200;74.8765;"Golden Temple" Amritsar
#IN|Maharashtra|Mumbai|19.0760|72.8777
Gateway of India;18.9220;72.8347
#NP|Bagmati|Nepal|27.7172|85.3240
Mount Everest;27.9881;86.9250
Boudhanath;27.7215;85.3620
#LK|Central Province|Sri Lanka|7.9570|80.7603
Sigiriya;7.9570;80.7603
#UZ|Samarqand|Samarkand|39.6542|66.9597
Registan;39.6548;66.9757
#AU|New South Wales|Sydney|-33.8688|151.2093
Sydney Opera House;-33.8568;151.2153
Sydney Harbour Bridge;-33.8523;151.2108
Bondi Beach;-33.8908;151.2743
#AU|Victoria|Melbourne|-37.8136|144.9631
Flinders Street Station;-37.8183;144.9671
Twelve Apostles;-38.6621;143.1051;"Twelve Apostles" Victoria
#AU|Northern Territory|Red Centre|-25.3444|131.0369
Uluru;-25.3444;131.0369
Whitehaven Beach;-20.2820;149.0390
#NZ|Auckland|Auckland|-36.8485|174.7633
Sky Tower;-36.8485;174.7622;"Sky Tower" Auckland
#NZ|Otago|South Island|-45.0312|168.6626
Milford Sound;-44.6414;167.8974
Aoraki / Mount Cook;-43.5950;170.1418;"Mount Cook" Aoraki
Church of the Good Shepherd;-44.0030;170.4830;"Church of the Good Shepherd" Tekapo
Queenstown;-45.0312;168.6626;Queenstown "Lake Wakatipu"
#PF|Leeward Islands|Bora Bora|-16.5004|-151.7415
Bora Bora;-16.5004;-151.7415;"Bora Bora" lagoon
`;
  const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const PLACES = [];
  RAW.trim().split('\n').forEach(line => {
    if (line[0] === '#') { const [cc, state, city, lat, lon] = line.slice(1).split('|'); PLACES.push({ cc, state, city, lat: +lat, lon: +lon, marks: [] }); return; }
    const [name, lat, lon, q] = line.split(';'), p = PLACES[PLACES.length - 1];
    p.marks.push({ id: slug(name + '-' + p.cc), name, lat: +lat, lon: +lon, q: q || '', city: p.city, state: p.state, cc: p.cc });
  });
  LM.places = PLACES;
  // Places found by the "what's near here" search, kept on this device.
  let FOUND = U.store.get('lmFound', []);
  const allPlaces = () => PLACES.concat(FOUND);
  LM.count = () => allPlaces().reduce((a, p) => a + p.marks.length, 0);
  LM.byId = id => { for (const p of allPlaces()) for (const m of p.marks) if (m.id === id) return m; return null; };
  LM.placeLine = lm => [lm.city, lm.state !== lm.city ? lm.state : '', CN[lm.cc] || ''].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');

  /* ── Where are you? (your weather location, or a place you picked for the weather screen) ── */
  const W = () => SS.settings.wx || {};
  const geoCache = U.store.get('lmGeo', {});
  function base() {
    const pl = W().place;
    if (pl && pl.lat != null) return { lat: pl.lat, lon: pl.lon, name: pl.name || 'Chosen place', picked: true };
    const L = SS.env2.loc();
    return { lat: L.lat, lon: L.lon, name: L.name, picked: false };
  }
  const nearest = (lat, lon) => allPlaces().map(p => ({ p, d: G.dist(lat, lon, p.lat, p.lon) })).sort((a, b) => a.d - b.d);
  async function locate() {
    const b = base(), key = b.lat.toFixed(2) + ',' + b.lon.toFixed(2);
    if (LM.where && LM.where.key === key) return LM.where;
    let geo = geoCache[key];
    if (!geo) {
      try {
        const d = await U.fetchJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${b.lat}&longitude=${b.lon}&localityLanguage=en`, { timeout: 8000 });
        geo = { city: d.city || d.locality || '', state: d.principalSubdivision || '', cc: d.countryCode || '' };
        geoCache[key] = geo;
        const ks = Object.keys(geoCache); if (ks.length > 40) delete geoCache[ks[0]];
        U.store.set('lmGeo', geoCache);
      } catch (e) { geo = null; }
    }
    const n = nearest(b.lat, b.lon)[0];
    LM.where = {
      key, lat: b.lat, lon: b.lon, picked: b.picked, guessed: !geo,
      city: (geo && geo.city) || (n && n.d < 40 ? n.p.city : b.name),
      state: (geo && geo.state) || (n && n.d < 150 ? n.p.state : ''),
      cc: (geo && geo.cc) || (n && n.d < 300 ? n.p.cc : ''),
    };
    return LM.where;
  }
  const SCOPES = ['city', 'state', 'country', 'world'];
  function scoped(w, scope) {
    const near = nearest(w.lat, w.lon);
    const sel = scope === 'world' ? near
      : scope === 'country' ? near.filter(x => (w.cc ? x.p.cc === w.cc : x.d < 400))
      : scope === 'state' ? near.filter(x => (w.cc && x.p.cc === w.cc && w.state && x.p.state === w.state) || (x.d < 150 && (!w.cc || x.p.cc === w.cc)))
      : near.filter(x => x.d < 40);
    const seen = new Set(), out = [];
    sel.forEach(x => x.p.marks.forEach(m => { if (!seen.has(m.id)) { seen.add(m.id); out.push(m); } }));
    return out;
  }
  LM.scopeLabel = function () {
    const w = LM.where, s = LM.widened || W().scope || 'city';
    if (!w) return 'Finding landmarks…';
    return s === 'world' ? 'Around the world' : s === 'country' ? (CN[w.cc] || w.cc || 'This country') : s === 'state' ? [w.state, CN[w.cc]].filter(Boolean).join(', ') || 'This region' : [w.city, w.state !== w.city ? w.state : ''].filter(Boolean).join(', ') || 'Near you';
  };

  /* ── Somewhere new: ask Wikipedia what's nearby, keep the best-known places that have a picture ── */
  const NOT_A_SIGHT = /\b(school|college|station|company|neighbou?rhood|street|road|avenue|highway|district|census|unincorporated|hospital|radio|television|newspaper|election|constituency|football club|f\.c\.|team|airline|airport|shopping (mall|centre|center)|company|corporation|headquarters|prison|cemetery|suburb|ward|village|town|city|municipality|county|borough|metro|line|route|album|film|band|episode)\b/i;
  const SIGHT = /\b(bridge|tower|park|museum|cathedral|church|basilica|temple|shrine|mosque|castle|palace|monument|memorial|square|plaza|island|mountain|peak|volcano|lake|beach|garden|stadium|skyscraper|landmark|fort|fortress|lighthouse|falls|waterfall|gate|statue|market|opera|theatre|theater|pier|canyon|harbou?r|bay|observatory|pagoda|ruins|abbey|monastery|hall|library|dam|arch|viaduct|aquarium|zoo|national park|world heritage)\b/i;
  const finding = {};
  LM.discover = async function (w, force) {
    w = w || LM.where; if (!w) return 0;
    if (finding[w.key]) return finding[w.key];
    if (!force && FOUND.some(p => p.key === w.key)) return 0;
    return (finding[w.key] = (async () => {
      const pages = {};
      let cont = '';
      for (let i = 0; i < 3; i++) {
        const d = await U.fetchJSON('https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch'
          + `&ggscoord=${w.lat}%7C${w.lon}&ggsradius=10000&ggslimit=50&prop=coordinates%7Cpageimages%7Cpageviews%7Cdescription&piprop=thumbnail%7Cname&pithumbsize=1920&pilimit=50&colimit=50&pvipdays=30${cont}`, { timeout: 12000 });
        Object.values((d.query && d.query.pages) || {}).forEach(p => {
          const o = pages[p.pageid] || (pages[p.pageid] = {});
          for (const k in p) { if (k === 'pageviews' && o.pageviews) Object.assign(o.pageviews, p.pageviews); else if (o[k] == null) o[k] = p[k]; }
        });
        if (!d.continue) break;
        cont = Object.entries(d.continue).filter(([k]) => k !== 'continue').map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join('');
      }
      const got = Object.values(pages).map(p => {
        const co = p.coordinates && p.coordinates[0], th = p.thumbnail && p.thumbnail.source;
        if (!co || !th || /\.svg/i.test(th)) return null;
        const text = p.title + ' ' + (p.description || '');
        if (NOT_A_SIGHT.test(text) && !SIGHT.test(text)) return null;
        const views = Object.values(p.pageviews || {}).reduce((a, v) => a + (v || 0), 0);
        return { p, co, th, score: (views + 30) * (SIGHT.test(text) ? 3 : 1) };
      }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 10);
      delete finding[w.key];
      if (!got.length) return 0;
      const city = w.city || 'Near you';
      const place = { key: w.key, found: true, cc: w.cc, state: w.state, city, lat: w.lat, lon: w.lon, at: Date.now(),
        marks: got.map(x => ({ id: 'w' + x.p.pageid, name: x.p.title.replace(/\s*\([^)]*\)$/, ''), lat: x.co.lat, lon: x.co.lon, q: `"${x.p.title.replace(/\s*\([^)]*\)$/, '')}"`, city, state: w.state, cc: w.cc, lead: x.th, wiki: x.p.title })) };
      // don't repeat landmarks the built-in list already has
      const have = new Set(PLACES.flatMap(p => p.marks.map(m => slug(m.name))));
      place.marks = place.marks.filter(m => !have.has(slug(m.name)));
      FOUND = FOUND.filter(p => p.key !== w.key).concat([place]).slice(-30);
      U.store.set('lmFound', FOUND);
      return place.marks.length;
    })().catch(e => { delete finding[w.key]; return 0; }));
  };
  LM.found = () => FOUND;
  LM.forget = () => { FOUND = []; U.store.set('lmFound', FOUND); LM.resolve(true); };

  /* ── Which landmarks are in play right now ── */
  let resolving = null;
  LM.resolve = function (force) {
    if (resolving) return resolving;
    return (resolving = (async () => {
      const w = await locate();
      let scope = W().scope || 'city', list = scoped(w, scope);
      // Nothing built in for this city? Look around on Wikipedia (once per place).
      if (scope === 'city' && list.length < 3 && !SS.env.cspBlocked) { LM.status = 'Looking for landmarks near you…'; SS.emit('landmarks'); await Promise.race([LM.discover(w), U.sleep(9000)]); list = scoped(w, scope); }
      LM.widened = '';
      for (let i = SCOPES.indexOf(scope) + 1; !list.length && i < SCOPES.length; i++) { list = scoped(w, SCOPES[i]); if (list.length) LM.widened = SCOPES[i]; }
      const sig = list.map(m => m.id).join(',');
      if (sig !== LM.sig || force) { LM.sig = sig; LM.list = list; LM.seq = []; LM.pos = 0; }
      LM.status = ''; LM.ready = true; resolving = null;
      SS.emit('landmarks');
      return list;
    })().catch(e => { resolving = null; LM.ready = true; SS.emit('landmarks'); return LM.list; }));
  };
  // The favourite comes round most often (every third picture). By default it's the headliner of the nearest place.
  LM.fav = () => { const f = W().fav && LM.list.find(m => m.id === W().fav); return f || LM.list[0] || null; };
  function rotation() {
    if (LM.seq.length - LM.pos < 8) {
      const fav = LM.fav(), rest = U.shuffle(LM.list.filter(m => m !== fav)), seq = LM.seq.slice(LM.pos);
      // nearby landmarks first on the very first pass, so the screen opens with your own city
      if (!LM.seq.length && (LM.widened || W().scope) !== 'world') rest.sort((a, b) => LM.list.indexOf(a) - LM.list.indexOf(b) + U.rand(-4, 4));
      if (!rest.length && fav) seq.push(fav.id);
      for (let i = 0; i < rest.length; i += 2) { if (fav) seq.push(fav.id); seq.push(rest[i].id); if (rest[i + 1]) seq.push(rest[i + 1].id); }
      LM.seq = seq; LM.pos = 0;
    }
    return LM.seq.slice(LM.pos, LM.pos + 8).map(id => LM.list.find(m => m.id === id)).filter(Boolean);
  }

  /* ── Photos (Wikimedia Commons) ── */
  const COMMONS = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*';
  const JUNK = /\b(map|plan|logo|diagram|drawing|engraving|lithograph|stamp|coin|scale model|plaque|sign\b|poster|ticket|postcard|interior|inside|detail|close-?up|construction|aerial view of the construction|flag|coat of arms|seal|icon|chart|graph|screenshot|panorama 360)\b/i;
  const store = U.store.get('lmPhotos', {});
  async function search(q, w) {
    const d = await U.fetchJSON(`${COMMONS}&generator=search&gsrnamespace=6&gsrlimit=30&gsrsearch=${encodeURIComponent(q)}&prop=imageinfo&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiurlwidth=${w}&iiextmetadatafilter=Artist%7CLicenseShortName`, { timeout: 14000 });
    return Object.values((d.query && d.query.pages) || {});
  }
  async function fetchPhotos(lm) {
    const big = Math.max(innerWidth, innerHeight) * Math.min(devicePixelRatio || 1, 2) > 2200, w = big ? 2560 : 1920;
    const term = lm.q || `"${lm.name}"`, sr = innerWidth / innerHeight;
    let pages = [];
    try { pages = await search(`${term} incategory:"Quality images" filetype:bitmap`, w); } catch (e) { /* fall through to the plain search */ }
    const good = p => { const im = p.imageinfo && p.imageinfo[0]; if (!im || !im.thumburl || !/jpe?g/.test(im.mime || '')) return false; const ar = im.width / im.height; return im.width >= 1400 && ar > 0.45 && ar < 2.7 && !JUNK.test(p.title); };
    let ok = pages.filter(good);
    if (ok.length < 4) { const more = await search(`${term} filetype:bitmap filew:>1800`, w); const have = new Set(ok.map(p => p.pageid)); ok = ok.concat(more.filter(p => good(p) && !have.has(p.pageid))); }
    // best search hits first, nudged toward pictures shaped like this screen
    ok.sort((a, b) => { const f = p => (p.index || 30) + Math.abs(Math.log((p.imageinfo[0].width / p.imageinfo[0].height) / sr)) * 7; return f(a) - f(b); });
    const list = ok.slice(0, 12).map(p => {
      const im = p.imageinfo[0], em = im.extmetadata || {}, v = k => U.text(em[k] && em[k].value);
      return { key: 'wm' + p.pageid, urls: [im.thumburl, im.size < 12e6 ? im.url : null].filter(Boolean), by: U.truncate(v('Artist'), 80), lic: v('LicenseShortName') || 'See file page', link: im.descriptionurl };
    });
    if (lm.lead) list.push({ key: 'lead', urls: [lm.lead], by: '', lic: 'See the Wikipedia page', link: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(lm.wiki || lm.name) });
    return list;
  }
  function photos(lm) {
    let c = LM.photos[lm.id];
    if (!c) {
      const s = store[lm.id];
      c = LM.photos[lm.id] = s && Date.now() - s.at < 5 * 864e5 && s.list.length ? { list: s.list, i: U.randInt(0, s.list.length - 1) } : { list: null, i: 0 };
    }
    if (!c.list && !c.loading && !(c.failedAt && Date.now() - c.failedAt < 120000)) {
      c.loading = true;
      fetchPhotos(lm).then(list => {
        c.loading = false;
        if (!list.length) { c.failedAt = Date.now(); c.empty = true; return; }
        c.list = U.shuffle(list.slice(0, 5)).concat(list.slice(5)); c.i = 0;
        store[lm.id] = { at: Date.now(), list };
        const ks = Object.keys(store); if (ks.length > 70) ks.sort((a, b) => store[a].at - store[b].at).slice(0, ks.length - 70).forEach(k => delete store[k]);
        U.store.set('lmPhotos', store);
        SS.emit('landmarks');
      }, () => { c.loading = false; c.failedAt = Date.now(); });
    }
    return c;
  }
  const toItem = (lm, ph) => ({ key: `lm:${lm.id}:${ph.key}`, src: 'landmarks', kind: 'photo', fill: true, urls: ph.urls, title: lm.name, creator: ph.by, detail: LM.placeLine(lm), license: ph.lic, link: ph.link, lm });
  // Snow globe look: the same landmark inside a glass dome. The Golden Gate Bridge is a model drawn in code (no photo needed).
  const MODELS = { 'golden-gate-bridge-us': 'gg' };
  const isGlobe = () => W().screen && W().look === 'globe';
  const modelFor = lm => (W().models !== false && MODELS[lm.id]) || '';
  const toGlobe = (lm, ph) => (ph ? Object.assign(toItem(lm, ph), { globe: true, kind: 'art' })
    : { key: `lm:${lm.id}:model`, src: 'landmarks', kind: 'art', globe: true, model: modelFor(lm), title: lm.name, creator: '', detail: LM.placeLine(lm), license: 'Drawn in code by this app', link: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(lm.name), lm });
  LM.sampleGlobe = () => toGlobe(LM.byId('golden-gate-bridge-us'), null);
  LM.drop = item => { const c = item && item.lm && LM.photos[item.lm.id]; if (c && c.list) c.list = c.list.filter(p => `lm:${item.lm.id}:${p.key}` !== item.key); };

  // The weather screen's next picture. null = still loading; undefined = can't (let the normal mix carry on).
  LM.take = function () {
    const globe = isGlobe();
    // nothing outside can load? the snow globe still works, with its drawn bridge
    if (!LM.ready) { LM.resolve(); return SS.env.cspBlocked ? (globe ? LM.sampleGlobe() : undefined) : null; }
    if (!LM.list.length || SS.env.cspBlocked) return globe ? LM.sampleGlobe() : undefined;
    const pin = W().pin && LM.list.find(m => m.id === W().pin);
    const rot = pin ? [pin] : rotation();
    const order = LM.jump ? [LM.jump].concat(rot.filter(m => m !== LM.jump)) : rot;
    for (let k = 0; k < order.length; k++) {
      const lm = order[k];
      if (globe && modelFor(lm)) {
        if (lm === LM.jump) LM.jump = null; else if (!pin) LM.pos += rot.indexOf(lm) + 1;
        order.slice(k + 1, k + 3).forEach(n => { if (!modelFor(n)) photos(n); LM.weather(n); });
        return toGlobe(lm, null);
      }
      const c = photos(lm);
      if (c.list && c.list.length) {
        if (lm === LM.jump) LM.jump = null;
        else if (!pin) LM.pos += rot.indexOf(lm) + 1;
        const ph = c.list[c.i++ % c.list.length];
        order.slice(k + 1, k + 3).forEach(n => { photos(n); LM.weather(n); });
        return globe ? toGlobe(lm, ph) : toItem(lm, ph);
      }
      if (k === 0 && lm === LM.jump && c.loading) return null;   // you asked for this one: wait for it
    }
    if (pin && !photos(pin).loading) { const r = rotation(); r.forEach(photos); }
    const tried = order.map(photos);
    return tried.every(c => !c.loading && c.failedAt) ? (globe ? LM.sampleGlobe() : undefined) : null;
  };
  // For the ordinary slideshow ("Landmarks" as a genre): a few pictures from the places in play.
  LM.batch = async function () {
    await LM.resolve();
    const picks = U.shuffle(LM.list.slice(0, 40)).slice(0, 3), out = [];
    for (const lm of picks) {
      const c = photos(lm);
      for (let i = 0; i < 60 && c.loading; i++) await U.sleep(200);
      if (c.list && c.list.length) out.push(toItem(lm, c.list[c.i++ % c.list.length]));
    }
    return out;
  };

  /* ── Weather at a spot (Open-Meteo). Always asked for in metric, shown in your units. ── */
  const wkey = (lat, lon) => (+lat).toFixed(2) + ',' + (+lon).toFixed(2);
  LM.wxNow = o => { const c = o && LM.wx[wkey(o.lat, o.lon)]; return c && c.data && Date.now() - c.data.at < 40 * 60e3 ? c.data : null; };
  LM.weather = function (o) {
    const k = wkey(o.lat, o.lon), c = LM.wx[k] || (LM.wx[k] = {});
    if (c.data && Date.now() - c.data.at < 10 * 60e3) return Promise.resolve(c.data);
    if (c.p) return c.p;
    if (c.failedAt && Date.now() - c.failedAt < 60000) return Promise.resolve(c.data || null);
    const ask = cur => U.fetchJSON(`https://api.open-meteo.com/v1/forecast?latitude=${o.lat}&longitude=${o.lon}&current=${cur}`
      + '&hourly=temperature_2m,weather_code,is_day,precipitation_probability&forecast_hours=13&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&forecast_days=1&timezone=auto', { timeout: 12000 });
    const BASIC = 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,cloud_cover,precipitation';
    // the extras (visibility, low cloud) sharpen the fog; if the service ever turns them down, the basics still work
    return (c.p = ask(BASIC + ',cloud_cover_low,snowfall,visibility').catch(() => ask(BASIC)).then(d => {
      const cu = d.current || {}, un = d.current_units || {}, hr = d.hourly || {}, dy = d.daily || {};
      let vis = cu.visibility; if (vis != null && /ft/i.test(un.visibility || '')) vis *= 0.3048;
      c.data = {
        t: cu.temperature_2m, feels: cu.apparent_temperature, rh: cu.relative_humidity_2m, code: cu.weather_code, day: cu.is_day, wind: cu.wind_speed_10m, dir: cu.wind_direction_10m,
        cloud: cu.cloud_cover, low: cu.cloud_cover_low, precip: cu.precipitation, snowfall: cu.snowfall, vis,
        hi: dy.temperature_2m_max && dy.temperature_2m_max[0], lo: dy.temperature_2m_min && dy.temperature_2m_min[0], sunrise: dy.sunrise && dy.sunrise[0], sunset: dy.sunset && dy.sunset[0],
        hours: (hr.time || []).map((t, i) => ({ t, temp: hr.temperature_2m[i], code: hr.weather_code[i], day: hr.is_day[i], pop: hr.precipitation_probability && hr.precipitation_probability[i] })).filter(x => x.t > (cu.time || '')).slice(0, 10),
        off: d.utc_offset_seconds, tz: d.timezone_abbreviation, at: Date.now(),
      };
      c.p = null; c.failedAt = 0;
      SS.emit('lmweather', { key: k });
      return c.data;
    }, () => { c.p = null; c.failedAt = Date.now(); return c.data || null; }));
  };
  // What the sky is doing, as 0–1 amounts the effects layer can draw.
  LM.scene = function (w) {
    if (!w || w.code == null) return null;
    const c = w.code, s = { fog: 0, rain: 0, snow: 0, storm: 0, sun: 0, night: w.day === 0 ? 1 : 0, wind: (w.wind || 0) / 1.609, dir: w.dir || 270 };
    s.cloud = U.clamp((w.cloud != null ? w.cloud : c === 3 ? 100 : c === 2 ? 55 : c === 1 ? 20 : c >= 45 ? 90 : 0) / 100, 0, 1);
    if (c === 45 || c === 48) s.fog = 0.85;
    if (w.vis != null) s.fog = Math.max(s.fog, w.vis < 800 ? 1 : w.vis < 2000 ? 0.78 : w.vis < 5000 ? 0.45 : w.vis < 9000 ? 0.2 : 0);
    if (!s.fog && w.low >= 90 && w.rh >= 93) s.fog = 0.3;
    s.rain = { 51: 0.2, 56: 0.2, 53: 0.3, 55: 0.42, 57: 0.42, 61: 0.45, 66: 0.45, 80: 0.5, 63: 0.7, 81: 0.75, 65: 1, 67: 1, 82: 1, 95: 0.85, 96: 1, 99: 1 }[c] || 0;
    s.snow = { 71: 0.4, 85: 0.5, 73: 0.7, 77: 0.5, 75: 1, 86: 1 }[c] || 0;
    s.storm = c >= 95 ? 1 : 0;
    if (!s.night && !s.rain && !s.snow && s.fog < 0.3) s.sun = U.clamp(1 - s.cloud * 1.6, 0, 1);
    s.kind = s.storm ? 'storm' : s.snow ? 'snow' : s.rain ? 'rain' : s.fog >= 0.45 ? 'fog' : s.cloud > 0.8 ? 'cloudy' : s.cloud > 0.3 ? 'partly' : s.night ? 'night' : 'clear';
    return s;
  };
  LM.SAMPLES = {
    fog: { kind: 'fog', label: 'Fog', fog: 1, rain: 0, snow: 0, storm: 0, sun: 0, night: 0, cloud: 0.9, wind: 8, dir: 270 },
    rain: { kind: 'rain', label: 'Rain', fog: 0.15, rain: 0.8, snow: 0, storm: 0, sun: 0, night: 0, cloud: 1, wind: 14, dir: 250 },
    snow: { kind: 'snow', label: 'Snow', fog: 0.2, rain: 0, snow: 0.85, storm: 0, sun: 0, night: 0, cloud: 1, wind: 6, dir: 300 },
    storm: { kind: 'storm', label: 'Thunderstorm', fog: 0.1, rain: 1, snow: 0, storm: 1, sun: 0, night: 0.5, cloud: 1, wind: 24, dir: 240 },
    clear: { kind: 'clear', label: 'Sunny', fog: 0, rain: 0, snow: 0, storm: 0, sun: 1, night: 0, cloud: 0.05, wind: 5, dir: 270 },
    cloudy: { kind: 'cloudy', label: 'Overcast', fog: 0, rain: 0, snow: 0, storm: 0, sun: 0, night: 0, cloud: 1, wind: 10, dir: 270 },
    night: { kind: 'night', label: 'Clear night', fog: 0, rain: 0, snow: 0, storm: 0, sun: 0, night: 1, cloud: 0.05, wind: 4, dir: 270 },
  };

  LM.init = function () {
    SS.on('settings', p => { if (p === 'cloud' || /^wx\.(scope|place|fav)|^env\.loc|^flight\.(lat|lon)/.test(p || '')) { LM.where = /^wx\.(scope|fav)/.test(p || '') ? LM.where : null; LM.resolve(true); } });
    setInterval(() => { if (W().screen || (SS.settings.weights.landmarks || 0) > 0) LM.resolve(); }, 15 * 60e3);
  };
})();
