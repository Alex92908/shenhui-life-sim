/* Credits for the real photos in assets/ — all from Wikimedia Commons under
   free licences (CC BY / CC BY-SA / CC0 / public domain). CC BY and BY-SA
   require attribution: every photo the game shows carries this credit line
   (author · licence · link to the file page). Regenerate the set with
   tools/photos/ (see DATA-PLAN.md). */
/** `source` set = not from Commons (e.g. an official promo page); shown instead of "Wikimedia Commons". */
export interface PhotoCredit { title: string; artist: string; license: string; page: string; source?: string }
export const PHOTO_CREDITS: Record<string, PhotoCredit> = {
 "sz-mission": {"title": "Mission Hills Resort, Shenzhen", "artist": "中国日报网 · 深圳政府合作页面", "license": "授权待确认", "page": "https://govt.chinadaily.com.cn/s/201812/17/WS5ce75ce0498e079e68021961/mission-hills-resort-shenzhen.html", "source": "官方宣传页（未获书面授权，上线前需确认）"},
 "sz-mission2": {"title": "Mission Hills Resort, Shenzhen", "artist": "中国日报网 · 深圳政府合作页面", "license": "授权待确认", "page": "https://govt.chinadaily.com.cn/s/201812/17/WS5ce75ce0498e079e68021961/mission-hills-resort-shenzhen.html", "source": "官方宣传页（未获书面授权，上线前需确认）"},
 "scene-park": {
  "title": "Shenzhen Bay Park Sunrise Theatre 20210904.jpg",
  "artist": "歪歪",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Shenzhen_Bay_Park_Sunrise_Theatre_20210904.jpg"
 },
 "scene-metro": {
  "title": "Shenzhen Metro Line 2 Train Interior.jpg",
  "artist": "Chris from Shenzhen, China",
  "license": "CC BY-SA 2.0",
  "page": "https://commons.wikimedia.org/wiki/File:Shenzhen_Metro_Line_2_Train_Interior.jpg"
 },
 "scene-train": {
  "title": "Car 16 interior of CR400AF-B-2119 (20191205185406).jpg",
  "artist": "N509FZ",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Car_16_interior_of_CR400AF-B-2119_(20191205185406).jpg"
 },
 "scene-station": {
  "title": "Shenzhen North Railway Station platforms 2023 02 part1.jpg",
  "artist": "Qwer132477",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Shenzhen_North_Railway_Station_platforms_2023_02_part1.jpg"
 },
 "scene-concourse": {
  "title": "Shenzhen North Railway Station waiting hall.JPG",
  "artist": "Livewireshock",
  "license": "CC BY-SA 3.0",
  "page": "https://commons.wikimedia.org/wiki/File:Shenzhen_North_Railway_Station_waiting_hall.JPG"
 },
 "scene-platform": {
  "title": "CR400AF-2187@QTP (20240403121616).jpg",
  "artist": "N509FZ",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:CR400AF-2187@QTP_(20240403121616).jpg"
 },
 "scene-office": {
  "title": "C4DI interior coworking space 2025.jpg",
  "artist": "Influence Media",
  "license": "CC BY 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:C4DI_interior_coworking_space_2025.jpg"
 },
 "scene-restaurant": {
  "title": "HK SW 上環 Sheung Wan Loon Kee 星月樓 Sky Cuisine Restaurant morning 飲早茶 Chinese breakfast tea interior March 2026 N13P 01.jpg",
  "artist": "Homm BoUretak BAORP",
  "license": "CC0",
  "page": "https://commons.wikimedia.org/wiki/File:HK_SW_%E4%B8%8A%E7%92%B0_Sheung_Wan_Loon_Kee_%E6%98%9F%E6%9C%88%E6%A8%93_Sky_Cuisine_Restaurant_morning_%E9%A3%B2%E6%97%A9%E8%8C%B6_Chinese_breakfast_tea_interior_March_2026_N13P_01.jpg"
 },
 "scene-market": {
  "title": "SZ Shenzhen Luohu Dongmen night market Dongmen Food Gourmet Palace March 2025 R12S 22.jpg",
  "artist": "Breandy Makallonz",
  "license": "CC0",
  "page": "https://commons.wikimedia.org/wiki/File:SZ_Shenzhen_Luohu_Dongmen_night_market_Dongmen_Food_Gourmet_Palace_March_2025_R12S_22.jpg"
 },
 "scene-mall": {
  "title": "SZ Hua Qiang SEG Electronics Market wd.JPG",
  "artist": "unknown author (public domain)",
  "license": "Public domain",
  "page": "https://commons.wikimedia.org/wiki/File:SZ_Hua_Qiang_SEG_Electronics_Market_wd.JPG"
 },
 "scene-kitchen": {
  "title": "Kitchen, Interior of apartment in Brisbane, 2025, 03.jpg",
  "artist": "Chris Olszewski",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Kitchen,_Interior_of_apartment_in_Brisbane,_2025,_03.jpg"
 },
 "scene-bedroom": {
  "title": "Bedroom, Interior of apartment in Brisbane, 2025, 02.jpg",
  "artist": "Chris Olszewski",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Bedroom,_Interior_of_apartment_in_Brisbane,_2025,_02.jpg"
 },
 "scene-bathroom": {
  "title": "Senmenjo and furoba.jpg",
  "artist": "Masaki Shiina",
  "license": "CC BY 2.0",
  "page": "https://commons.wikimedia.org/wiki/File:Senmenjo_and_furoba.jpg"
 },
 "scene-gym": {
  "title": "Interior of new modern gym with equipment.jpg",
  "artist": "Shixart1985",
  "license": "CC BY 2.0",
  "page": "https://commons.wikimedia.org/wiki/File:Interior_of_new_modern_gym_with_equipment.jpg"
 },
 "scene-bus": {
  "title": "SZ 深圳 Shenzhen Bus M349 interior visitors July 2017 IX1.jpg",
  "artist": "GEei Ginhee wins",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:SZ_%E6%B7%B1%E5%9C%B3_Shenzhen_Bus_M349_interior_visitors_July_2017_IX1.jpg"
 },
 "scene-taxi": {
  "title": "BYD E6 Shenzhen Taxi front view (202411131226).jpg",
  "artist": "茅野ふたば",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:BYD_E6_Shenzhen_Taxi_front_view_(202411131226).jpg"
 },
 "scene-home": {
  "title": "Modern living room with stylish furniture and a view of the outdoors in a cozy apartment setting.jpg",
  "artist": "Shixart1985",
  "license": "CC BY 2.0",
  "page": "https://commons.wikimedia.org/wiki/File:Modern_living_room_with_stylish_furniture_and_a_view_of_the_outdoors_in_a_cozy_apartment_setting.jpg"
 },
 "place-wow": {
  "title": "Eiffel Tower at Window of the World, Shenzhen 077.jpg",
  "artist": "Arman Aziz",
  "license": "CC BY 2.5",
  "page": "https://commons.wikimedia.org/wiki/File:Eiffel_Tower_at_Window_of_the_World,_Shenzhen_077.jpg"
 },
 "place-happy": {
  "title": "Happy Valley Shenzhen - 5763616237.jpg",
  "artist": "Jeremy Thompson",
  "license": "CC BY 2.0",
  "page": "https://commons.wikimedia.org/wiki/File:Happy_Valley_Shenzhen_-_5763616237.jpg"
 },
 "place-lianhua": {
  "title": "Lianhuashan Park Shenzen China 1310769.jpg",
  "artist": "Ermell",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Lianhuashan_Park_Shenzen_China_1310769.jpg"
 },
 "place-bay": {
  "title": "Rainbow Shenzhen Bay Park Sunrise Theatre 20210904.jpg",
  "artist": "歪歪",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Rainbow_Shenzhen_Bay_Park_Sunrise_Theatre_20210904.jpg"
 },
 "place-dameisha": {
  "title": "大梅沙愿望塔鸟瞰沙滩.jpg",
  "artist": "董辰兴",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:%E5%A4%A7%E6%A2%85%E6%B2%99%E6%84%BF%E6%9C%9B%E5%A1%94%E9%B8%9F%E7%9E%B0%E6%B2%99%E6%BB%A9.jpg"
 },
 "place-hq1": {
  "title": "Huaqiangbei&Shennan Cross2021.jpg",
  "artist": "Charlie fong",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Huaqiangbei%26Shennan_Cross2021.jpg"
 },
 "place-hq2": {
  "title": "Man on a scooter pulling a cart with packages in Shenzhen's Huaqiangbei..jpg",
  "artist": "Shenzhen Pages",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Man_on_a_scooter_pulling_a_cart_with_packages_in_Shenzhen%27s_Huaqiangbei..jpg"
 },
 "place-dm1": {
  "title": "SZ Shenzhen Luohu Dongmen night market Dongmen Food Gourmet Palace March 2025 R12S 01.jpg",
  "artist": "Breandy Makallonz",
  "license": "CC0",
  "page": "https://commons.wikimedia.org/wiki/File:SZ_Shenzhen_Luohu_Dongmen_night_market_Dongmen_Food_Gourmet_Palace_March_2025_R12S_01.jpg"
 },
 "place-dm2": {
  "title": "OLD STREET(LAO JIE) SHENZHEN (28).jpg",
  "artist": "Dinkun Chen",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:OLD_STREET(LAO_JIE)_SHENZHEN_(28).jpg"
 },
 "place-szb1": {
  "title": "Shenzhen North Railway Station East Square.jpg",
  "artist": "Baycrest",
  "license": "CC BY-SA 2.5",
  "page": "https://commons.wikimedia.org/wiki/File:Shenzhen_North_Railway_Station_East_Square.jpg"
 },
 "place-szb2": {
  "title": "Shenzhen North railway station waiting area.jpg",
  "artist": "Percival Kestreltail",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Shenzhen_North_railway_station_waiting_area.jpg"
 },
 "place-xh1": {
  "title": "Huizhou Xihu 2013.09.20 10-29-16.jpg",
  "artist": "Zhangzhugang",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Huizhou_Xihu_2013.09.20_10-29-16.jpg"
 },
 "place-xh2": {
  "title": "Huizhou Sizhou Ta 2013.09.20 10-08-08.jpg",
  "artist": "Zhangzhugang",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Huizhou_Sizhou_Ta_2013.09.20_10-08-08.jpg"
 },
 "place-lf1": {
  "title": "Luofu Village and Luofu Bridge 20090725b.jpg",
  "artist": "Matt_Chang",
  "license": "CC BY 2.0",
  "page": "https://commons.wikimedia.org/wiki/File:Luofu_Village_and_Luofu_Bridge_20090725b.jpg"
 },
 "place-lf2": {
  "title": "Luofu 羅浮 - panoramio.jpg",
  "artist": "lienyuan lee",
  "license": "CC BY 3.0",
  "page": "https://commons.wikimedia.org/wiki/File:Luofu_%E7%BE%85%E6%B5%AE_-_panoramio.jpg"
 },
 "place-sy": {
  "title": "Double-Moon Bay.jpg",
  "artist": "惠州轨道交通",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Double-Moon_Bay.jpg"
 },
 "place-sy2": {
  "title": "稔平半岛港口镇观景台往双月湾.jpg",
  "artist": "Cwek",
  "license": "CC BY 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:%E7%A8%94%E5%B9%B3%E5%8D%8A%E5%B2%9B%E6%B8%AF%E5%8F%A3%E9%95%87%E8%A7%82%E6%99%AF%E5%8F%B0%E5%BE%80%E5%8F%8C%E6%9C%88%E6%B9%BE.jpg"
 },
 "place-hejiang": {
  "title": "合江楼 6130.jpg",
  "artist": "Cangminzho",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:%E5%90%88%E6%B1%9F%E6%A5%BC_6130.jpg"
 },
 "place-hejiang2": {
  "title": "合江楼、东新桥 6068.jpg",
  "artist": "Cangminzho",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:%E5%90%88%E6%B1%9F%E6%A5%BC%E3%80%81%E4%B8%9C%E6%96%B0%E6%A1%A5_6068.jpg"
 },
 "place-turtle": {
  "title": "Sea Turtle in Huidong 23 26 56 642000.jpg",
  "artist": "David290",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Sea_Turtle_in_Huidong_23_26_56_642000.jpg"
 },
 "place-turtle2": {
  "title": "Olive Ridley Sea Turtle Hatchlings.jpg",
  "artist": "Bethany McCarter",
  "license": "CC BY 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Olive_Ridley_Sea_Turtle_Hatchlings.jpg"
 },
 "place-xunliao": {
  "title": "Seascape of Xunliao Bay.jpg",
  "artist": "Alice Fuweixia",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Seascape_of_Xunliao_Bay.jpg"
 },
 "place-aquarium": {
  "title": "Aquarium Tunnel.jpg",
  "artist": "daryl_mitchell",
  "license": "CC BY-SA 2.0",
  "page": "https://commons.wikimedia.org/wiki/File:Aquarium_Tunnel.jpg"
 },
 "place-aquarium2": {
  "title": "Jellyfish in a tank.jpg",
  "artist": "Mtheletter",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Jellyfish_in_a_tank.jpg"
 },
 "place-wheel": {
  "title": "Bay Glory 2022.jpg",
  "artist": "Iswzo",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Bay_Glory_2022.jpg"
 },
 "place-wheel2": {
  "title": "湾区之光的轿舱2.jpg",
  "artist": "Lhzss8",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:%E6%B9%BE%E5%8C%BA%E4%B9%8B%E5%85%89%E7%9A%84%E8%BD%BF%E8%88%B12.jpg"
 },
 "place-wow2": {
  "title": "WINDOWS OF THE WORLD SHENZHEN (56).jpg",
  "artist": "Dinkun Chen",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:WINDOWS_OF_THE_WORLD_SHENZHEN_(56).jpg"
 },
 "place-dameisha2": {
  "title": "Dameisha viewed from the sea 300meters high.jpg",
  "artist": "Gigel.atat",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Dameisha_viewed_from_the_sea_300meters_high.jpg"
 },
 "place-xlhotel": {
  "title": "Hotel, Xunliao Bay.jpg",
  "artist": "Alice Fuweixia",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Hotel,_Xunliao_Bay.jpg"
 },
 "sz-cablecar": {
  "title": "OCT East in June 2019.jpg",
  "artist": "Mx. Granger",
  "license": "CC0",
  "page": "https://commons.wikimedia.org/wiki/File:OCT_East_in_June_2019.jpg"
 },
 "sz-coaster": {
  "title": "Happy Valley Shenzhen - 5763616237.jpg",
  "artist": "Jeremy Thompson",
  "license": "CC BY 2.0",
  "page": "https://commons.wikimedia.org/wiki/File:Happy_Valley_Shenzhen_-_5763616237.jpg"
 },
 "sz-dapeng": {
  "title": "Dapeng Fortress, Shenzhen (3).jpg",
  "artist": "Dinkun Chen",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Dapeng_Fortress,_Shenzhen_(3).jpg"
 },
 "sz-dapeng2": {
  "title": "Dapeng Fortress, Shenzhen (41).jpg",
  "artist": "Dinkun Chen",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Dapeng_Fortress,_Shenzhen_(41).jpg"
 },
 "sz-fenghuang": {
  "title": "Temple area on Fenghuang Mountain.jpg",
  "artist": "Mx. Granger",
  "license": "CC0",
  "page": "https://commons.wikimedia.org/wiki/File:Temple_area_on_Fenghuang_Mountain.jpg"
 },
 "sz-fenghuang2": {
  "title": "View on Fenghuang Mountain.jpg",
  "artist": "Mx. Granger",
  "license": "CC0",
  "page": "https://commons.wikimedia.org/wiki/File:View_on_Fenghuang_Mountain.jpg"
 },
 "sz-jinxiu": {
  "title": "1 shenzhen splendid china 2011.JPG",
  "artist": "chensiyuan",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:1_shenzhen_splendid_china_2011.JPG"
 },
 "sz-jinxiu2": {
  "title": "Night at Splendid China Folk Village 01.JPG",
  "artist": "Abasaa",
  "license": "Public domain",
  "page": "https://commons.wikimedia.org/wiki/File:Night_at_Splendid_China_Folk_Village_01.JPG"
 },
 "sz-octeast": {
  "title": "深圳东部华侨城 OCT, Shenzhen - panoramio.jpg",
  "artist": "wanghongliu",
  "license": "CC BY-SA 3.0",
  "page": "https://commons.wikimedia.org/wiki/File:%E6%B7%B1%E5%9C%B3%E4%B8%9C%E9%83%A8%E5%8D%8E%E4%BE%A8%E5%9F%8E_OCT,_Shenzhen_-_panoramio.jpg"
 },
 "sz-octharbour": {
  "title": "OCT HARBOUR, SHENZHEN (2).jpg",
  "artist": "Dinkun Chen",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:OCT_HARBOUR,_SHENZHEN_(2).jpg"
 },
 "sz-octharbour2": {
  "title": "OCT HARBOUR, SHENZHEN (3).jpg",
  "artist": "Dinkun Chen",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:OCT_HARBOUR,_SHENZHEN_(3).jpg"
 },
 "sz-qingqing": {
  "title": "青青世界 Evergreen Resort - panoramio (1).jpg",
  "artist": "wanghongliu",
  "license": "CC BY-SA 3.0",
  "page": "https://commons.wikimedia.org/wiki/File:%E9%9D%92%E9%9D%92%E4%B8%96%E7%95%8C_Evergreen_Resort_-_panoramio_(1).jpg"
 },
 "sz-qiniang": {
  "title": "Qiniangshan, Shenzhen.jpg",
  "artist": "Wishds",
  "license": "CC BY-SA 3.0",
  "page": "https://commons.wikimedia.org/wiki/File:Qiniangshan,_Shenzhen.jpg"
 },
 "sz-safari": {
  "title": "TOYOTA COASTER (B40 B50) IN SHENZHEN SAFARI PARK (2).jpg",
  "artist": "Dinkun Chen",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:TOYOTA_COASTER_(B40_B50)_IN_SHENZHEN_SAFARI_PARK_(2).jpg"
 },
 "sz-safari2": {
  "title": "SHENZHEN SAFARI PARK (45).jpg",
  "artist": "Dinkun Chen",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:SHENZHEN_SAFARI_PARK_(45).jpg"
 },
 "sz-swcac": {
  "title": "海上世界文化艺术中心 2.jpg",
  "artist": "Mx. Granger",
  "license": "CC0",
  "page": "https://commons.wikimedia.org/wiki/File:%E6%B5%B7%E4%B8%8A%E4%B8%96%E7%95%8C%E6%96%87%E5%8C%96%E8%89%BA%E6%9C%AF%E4%B8%AD%E5%BF%83_2.jpg"
 },
 "sz-swcac2": {
  "title": "海上世界文化艺术中心 1.jpg",
  "artist": "Mx. Granger",
  "license": "CC0",
  "page": "https://commons.wikimedia.org/wiki/File:%E6%B5%B7%E4%B8%8A%E4%B8%96%E7%95%8C%E6%96%87%E5%8C%96%E8%89%BA%E6%9C%AF%E4%B8%AD%E5%BF%83_1.jpg"
 },
 "sz-tanglang": {
  "title": "塘朗山 05.jpg",
  "artist": "Mx. Granger",
  "license": "CC0",
  "page": "https://commons.wikimedia.org/wiki/File:%E5%A1%98%E6%9C%97%E5%B1%B1_05.jpg"
 },
 "sz-tanglang2": {
  "title": "塘朗山 07.jpg",
  "artist": "Mx. Granger",
  "license": "CC0",
  "page": "https://commons.wikimedia.org/wiki/File:%E5%A1%98%E6%9C%97%E5%B1%B1_07.jpg"
 },
 "sz-wutong": {
  "title": "WUTONG MOUNTAIN, SHENZHEN (16).jpg",
  "artist": "Dinkun Chen",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:WUTONG_MOUNTAIN,_SHENZHEN_(16).jpg"
 },
 "sz-wutong2": {
  "title": "WUTONG MOUNTAIN, SHENZHEN (5).jpg",
  "artist": "Dinkun Chen",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:WUTONG_MOUNTAIN,_SHENZHEN_(5).jpg"
 },
 "sz-xianhu": {
  "title": "Gravesia vestita -深圳仙湖植物園 Fairy Lake Botanical Garden, China- (9198098043).jpg",
  "artist": "阿橋 HQ",
  "license": "CC BY-SA 2.0",
  "page": "https://commons.wikimedia.org/wiki/File:Gravesia_vestita_-%E6%B7%B1%E5%9C%B3%E4%BB%99%E6%B9%96%E6%A4%8D%E7%89%A9%E5%9C%92_Fairy_Lake_Botanical_Garden,_China-_(9198098043).jpg"
 },
 "sz-xianhu2": {
  "title": "仙人掌-般若 Astrophytum ornatum -深圳仙湖植物園 Fairy Lake Botanical Garden, China- (9229857458).jpg",
  "artist": "阿橋 HQ",
  "license": "CC BY-SA 2.0",
  "page": "https://commons.wikimedia.org/wiki/File:%E4%BB%99%E4%BA%BA%E6%8E%8C-%E8%88%AC%E8%8B%A5_Astrophytum_ornatum_-%E6%B7%B1%E5%9C%B3%E4%BB%99%E6%B9%96%E6%A4%8D%E7%89%A9%E5%9C%92_Fairy_Lake_Botanical_Garden,_China-_(9229857458).jpg"
 },
 "sz-xichong": {
  "title": "Sunset on Xichong.JPG",
  "artist": "Clestur",
  "license": "Public domain",
  "page": "https://commons.wikimedia.org/wiki/File:Sunset_on_Xichong.JPG"
 },
 "sz-xichong2": {
  "title": "西涌(XiChong) - panoramio.jpg",
  "artist": "kung.jon",
  "license": "CC BY-SA 3.0",
  "page": "https://commons.wikimedia.org/wiki/File:%E8%A5%BF%E6%B6%8C(XiChong)_-_panoramio.jpg"
 },
 "sz-yangmeikeng": {
  "title": "Yangmeikeng, Dapeng.jpg",
  "artist": "Wishds",
  "license": "CC BY-SA 3.0",
  "page": "https://commons.wikimedia.org/wiki/File:Yangmeikeng,_Dapeng.jpg"
 },
 "sz-yangmeikeng2": {
  "title": "ShenZhen,China(杨梅坑) - panoramio.jpg",
  "artist": "Leo Xue",
  "license": "CC BY 3.0",
  "page": "https://commons.wikimedia.org/wiki/File:ShenZhen,China(%E6%9D%A8%E6%A2%85%E5%9D%91)_-_panoramio.jpg"
 },
 "sz-zhongying": {
  "title": "Chung Ying Street, 25 May 2011.jpg",
  "artist": "Chintunglee",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Chung_Ying_Street,_25_May_2011.jpg"
 },
 "sz-zhongying2": {
  "title": "Chung Ying Street Garden, 19 November 2024.jpg",
  "artist": "李月文",
  "license": "CC BY-SA 4.0",
  "page": "https://commons.wikimedia.org/wiki/File:Chung_Ying_Street_Garden,_19_November_2024.jpg"
 }
};
/** Credit for an imported asset URL (Vite keeps the file name: …/place-xh1-[hash].jpg). */
export function creditFor(url: string | undefined): PhotoCredit | null {
  if (!url) return null;
  const base = url.split("/").pop() ?? "";
  const key = Object.keys(PHOTO_CREDITS).sort((a, b) => b.length - a.length).find((k) => base === `${k}.jpg` || base.startsWith(`${k}-`) || base.startsWith(`${k}.`));
  return key ? PHOTO_CREDITS[key]! : null;
}
