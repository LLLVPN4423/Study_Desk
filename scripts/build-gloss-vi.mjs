/**
 * Build Vietnamese gloss overlays for JP/EN vocab + grammar (merge into JSON).
 * Uses curated overrides + MyMemory (en|vi). Cache: scripts/.cache/gloss-vi-mt.json
 *
 * Usage:
 *   node scripts/build-gloss-vi.mjs --jp N4 --en A2
 *   node scripts/build-gloss-vi.mjs --all-remaining
 *   node scripts/build-gloss-vi.mjs --jp N3,N2 --grammar-only
 *   node scripts/build-gloss-vi.mjs --jp N5 --en A1   (rebuild / fill miss)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cachePath = join(root, "scripts", ".cache", "gloss-vi-mt.json");

const POS_VI = {
  "be-verb": "động từ to be",
  noun: "danh từ",
  n: "danh từ",
  verb: "động từ",
  v: "động từ",
  adjective: "tính từ",
  adj: "tính từ",
  adverb: "trạng từ",
  adv: "trạng từ",
  pronoun: "đại từ",
  preposition: "giới từ",
  conjunction: "liên từ",
  interjection: "thán từ",
  article: "mạo từ",
  determiner: "hạn định từ",
  auxiliary: "trợ động từ",
  modal: "động từ khuyết thiếu",
  numeral: "số từ",
  particle: "trợ từ",
};

/** High-quality overrides (EN headword or EN meaning phrase → VI). */
const OVERRIDE = {
  // contractions / function
  "'m": "dạng rút của am — thì / là (I)",
  "'re": "dạng rút của are — thì / là",
  "'s": "dạng rút của is/has — thì / là / có",
  "'ll": "dạng rút của will — sẽ",
  "'ve": "dạng rút của have — đã / có",
  "'d": "dạng rút của had/would",
  "n't": "dạng rút của not — không",
  a: "một (mạo từ không xác định)",
  an: "một (trước nguyên âm)",
  the: "mạo từ xác định",
  i: "tôi",
  you: "bạn",
  he: "anh ấy",
  she: "cô ấy",
  it: "nó",
  we: "chúng tôi / chúng ta",
  they: "họ",
  is: "thì / là",
  am: "thì / là (I)",
  are: "thì / là",
  be: "thì / là / ở",
  yes: "có / vâng",
  no: "không",
  not: "không",
  and: "và",
  or: "hoặc",
  but: "nhưng",
  in: "trong / ở trong",
  on: "trên / vào",
  at: "ở / lúc",
  to: "đến / để",
  of: "của",
  for: "cho / vì",
  with: "với",
  from: "từ",
  this: "này",
  that: "đó",
  these: "những cái này",
  those: "những cái đó",
  my: "của tôi",
  your: "của bạn",
  his: "của anh ấy",
  her: "của cô ấy",
  its: "của nó",
  our: "của chúng tôi",
  their: "của họ",
  about: "về / khoảng",
  above: "phía trên",
  across: "băng qua",
  after: "sau",
  again: "lại / lần nữa",
  against: "chống lại / dựa vào",
  all: "tất cả",
  almost: "hầu như",
  along: "dọc theo",
  already: "đã rồi",
  also: "cũng",
  always: "luôn luôn",
  among: "giữa (nhiều)",
  any: "bất kỳ",
  anyone: "bất kỳ ai",
  anything: "bất cứ gì",
  anywhere: "bất cứ đâu",
  around: "xung quanh / khoảng",
  as: "như / khi",
  ask: "hỏi / yêu cầu",
  at: "ở / lúc",
  away: "đi / xa",
  back: "lưng / trở lại",
  bad: "xấu / tệ",
  bag: "túi",
  ball: "quả bóng",
  bank: "ngân hàng / bờ",
  bathroom: "phòng tắm",
  be: "thì / là",
  beautiful: "đẹp",
  because: "bởi vì",
  become: "trở thành",
  bed: "giường",
  before: "trước",
  begin: "bắt đầu",
  behind: "phía sau",
  believe: "tin",
  below: "phía dưới",
  between: "giữa (hai)",
  big: "to / lớn",
  bill: "hóa đơn",
  bird: "chim",
  birthday: "sinh nhật",
  black: "đen",
  blue: "xanh dương",
  boat: "thuyền",
  body: "cơ thể",
  book: "sách",
  both: "cả hai",
  box: "hộp",
  boy: "cậu bé",
  bread: "bánh mì",
  break: "phá / nghỉ giải lao",
  breakfast: "bữa sáng",
  bring: "mang đến",
  brother: "anh / em trai",
  brown: "nâu",
  build: "xây",
  bus: "xe buýt",
  business: "kinh doanh / việc",
  busy: "bận",
  but: "nhưng",
  buy: "mua",
  by: "bởi / bên cạnh / trước",
  cafe: "quán cà phê",
  call: "gọi",
  camera: "máy ảnh",
  can: "có thể",
  car: "xe hơi",
  card: "thẻ / danh thiếp",
  care: "chăm sóc / quan tâm",
  carry: "mang / vác",
  cat: "mèo",
  center: "trung tâm",
  chair: "ghế",
  change: "thay đổi / tiền lẻ",
  cheap: "rẻ",
  child: "đứa trẻ",
  children: "trẻ em",
  choose: "chọn",
  city: "thành phố",
  class: "lớp học",
  clean: "sạch / lau",
  close: "đóng / gần",
  clothes: "quần áo",
  coffee: "cà phê",
  cold: "lạnh",
  college: "cao đẳng / đại học",
  color: "màu",
  come: "đến",
  company: "công ty",
  computer: "máy tính",
  cook: "nấu",
  cool: "mát / ngầu",
  country: "đất nước / nông thôn",
  course: "khóa học / tất nhiên",
  cousin: "anh chị em họ",
  cup: "cốc",
  cut: "cắt",
  dad: "bố",
  dance: "nhảy",
  dark: "tối",
  date: "ngày / hẹn",
  daughter: "con gái",
  day: "ngày",
  dear: "thân mến",
  decide: "quyết định",
  delicious: "ngon",
  desk: "bàn làm việc",
  different: "khác",
  difficult: "khó",
  dinner: "bữa tối",
  dirty: "bẩn",
  do: "làm",
  doctor: "bác sĩ",
  dog: "chó",
  door: "cửa",
  down: "xuống",
  draw: "vẽ",
  drink: "uống / đồ uống",
  drive: "lái xe",
  each: "mỗi",
  early: "sớm",
  east: "hướng đông",
  easy: "dễ",
  eat: "ăn",
  egg: "trứng",
  eight: "tám",
  eighteen: "mười tám",
  eighty: "tám mươi",
  either: "một trong hai",
  eleven: "mười một",
  else: "khác",
  email: "email",
  end: "kết thúc / cuối",
  enjoy: "thưởng thức",
  enough: "đủ",
  enter: "vào",
  evening: "buổi tối",
  every: "mỗi",
  everybody: "mọi người",
  everyone: "mọi người",
  everything: "mọi thứ",
  everywhere: "mọi nơi",
  example: "ví dụ",
  excuse: "xin lỗi / bào chữa",
  exercise: "tập luyện / bài tập",
  expensive: "đắt",
  eye: "mắt",
  face: "khuôn mặt",
  fact: "sự thật",
  family: "gia đình",
  famous: "nổi tiếng",
  far: "xa",
  fast: "nhanh",
  father: "bố",
  feel: "cảm thấy",
  feeling: "cảm giác",
  few: "một vài",
  fifteen: "mười lăm",
  fifty: "năm mươi",
  fill: "đổ đầy",
  film: "phim",
  find: "tìm thấy",
  fine: "ổn / tốt",
  finish: "hoàn thành",
  fire: "lửa",
  first: "đầu tiên",
  fish: "cá / câu cá",
  five: "năm",
  floor: "sàn / tầng",
  flower: "hoa",
  fly: "bay",
  food: "thức ăn",
  foot: "bàn chân",
  football: "bóng đá",
  for: "cho / vì",
  forget: "quên",
  form: "hình thức / mẫu đơn",
  forty: "bốn mươi",
  four: "bốn",
  fourteen: "mười bốn",
  free: "miễn phí / tự do",
  friend: "bạn",
  from: "từ",
  front: "phía trước",
  fruit: "trái cây",
  full: "đầy",
  fun: "vui",
  funny: "buồn cười",
  future: "tương lai",
  game: "trò chơi",
  garden: "vườn",
  get: "lấy / trở nên",
  girl: "cô gái",
  give: "cho",
  glass: "ly / kính",
  go: "đi",
  good: "tốt",
  goodbye: "tạm biệt",
  grandfather: "ông",
  grandmother: "bà",
  great: "tuyệt vời / lớn",
  green: "xanh lá",
  grey: "xám",
  group: "nhóm",
  grow: "phát triển / trồng",
  guess: "đoán",
  guitar: "đàn guitar",
  hair: "tóc",
  half: "một nửa",
  hand: "bàn tay",
  happen: "xảy ra",
  happy: "vui vẻ / hạnh phúc",
  hard: "khó / cứng",
  hat: "mũ",
  have: "có",
  he: "anh ấy",
  head: "đầu",
  health: "sức khỏe",
  hear: "nghe",
  heart: "tim",
  heat: "nhiệt / sưởi",
  heavy: "nặng",
  hello: "xin chào",
  help: "giúp",
  her: "cô ấy / của cô ấy",
  here: "ở đây",
  high: "cao",
  him: "anh ấy (tân ngữ)",
  his: "của anh ấy",
  history: "lịch sử",
  hobby: "sở thích",
  hold: "cầm / giữ",
  holiday: "ngày nghỉ / kỳ nghỉ",
  home: "nhà",
  homework: "bài tập về nhà",
  hope: "hy vọng",
  hospital: "bệnh viện",
  hot: "nóng",
  hotel: "khách sạn",
  hour: "giờ",
  house: "ngôi nhà",
  how: "như thế nào",
  however: "tuy nhiên",
  hundred: "một trăm",
  hungry: "đói",
  husband: "chồng",
  i: "tôi",
  ice: "đá",
  idea: "ý tưởng",
  if: "nếu",
  important: "quan trọng",
  in: "trong",
  information: "thông tin",
  inside: "bên trong",
  instead: "thay vào đó",
  interest: "sở thích / lãi",
  interesting: "thú vị",
  into: "vào trong",
  invite: "mời",
  island: "hòn đảo",
  it: "nó",
  its: "của nó",
  job: "công việc",
  join: "tham gia",
  juice: "nước ép",
  just: "chỉ / vừa mới",
  keep: "giữ",
  key: "chìa khóa",
  kind: "loại / tử tế",
  kitchen: "nhà bếp",
  know: "biết",
  lake: "hồ",
  land: "đất / hạ cánh",
  language: "ngôn ngữ",
  large: "lớn",
  last: "cuối cùng / lần trước",
  late: "muộn",
  later: "sau này",
  laugh: "cười",
  learn: "học",
  least: "ít nhất",
  leave: "rời đi / để lại",
  left: "trái / còn lại",
  leg: "chân",
  less: "ít hơn",
  let: "để / cho phép",
  letter: "lá thư / chữ cái",
  library: "thư viện",
  lie: "nằm / nói dối",
  life: "cuộc sống",
  light: "ánh sáng / nhẹ",
  like: "thích / như",
  line: "đường kẻ / hàng",
  list: "danh sách",
  listen: "lắng nghe",
  little: "nhỏ / một chút",
  live: "sống",
  local: "địa phương",
  long: "dài / lâu",
  look: "nhìn",
  lose: "mất / thua",
  lot: "nhiều",
  love: "yêu / tình yêu",
  low: "thấp",
  lunch: "bữa trưa",
  machine: "máy",
  magazine: "tạp chí",
  main: "chính",
  make: "làm / tạo",
  man: "người đàn ông",
  many: "nhiều",
  map: "bản đồ",
  market: "chợ",
  marry: "kết hôn",
  matter: "vấn đề / quan trọng",
  may: "có thể / tháng Năm",
  maybe: "có lẽ",
  me: "tôi (tân ngữ)",
  meal: "bữa ăn",
  mean: "có nghĩa / xấu tính",
  meaning: "nghĩa",
  meat: "thịt",
  meet: "gặp",
  meeting: "cuộc họp",
  member: "thành viên",
  menu: "thực đơn",
  message: "tin nhắn",
  milk: "sữa",
  million: "một triệu",
  mind: "tâm trí / ngại",
  minute: "phút",
  miss: "nhớ / bỏ lỡ",
  modern: "hiện đại",
  moment: "khoảnh khắc",
  money: "tiền",
  month: "tháng",
  more: "nhiều hơn",
  morning: "buổi sáng",
  most: "hầu hết",
  mother: "mẹ",
  mountain: "núi",
  mouth: "miệng",
  move: "di chuyển",
  movie: "phim",
  much: "nhiều",
  museum: "bảo tàng",
  music: "âm nhạc",
  must: "phải",
  my: "của tôi",
  name: "tên",
  national: "quốc gia",
  near: "gần",
  need: "cần",
  neighbor: "hàng xóm",
  never: "không bao giờ",
  new: "mới",
  news: "tin tức",
  next: "tiếp theo",
  nice: "dễ thương / tốt",
  night: "đêm",
  nine: "chín",
  nineteen: "mười chín",
  ninety: "chín mươi",
  no: "không",
  nobody: "không ai",
  noise: "tiếng ồn",
  none: "không có gì",
  noon: "buổi trưa",
  north: "hướng bắc",
  nose: "mũi",
  not: "không",
  note: "ghi chú",
  nothing: "không gì",
  now: "bây giờ",
  number: "số",
  nurse: "y tá",
  "o'clock": "giờ đúng",
  of: "của",
  off: "tắt / ra khỏi",
  office: "văn phòng",
  often: "thường xuyên",
  oh: "ồ",
  oil: "dầu",
  ok: "được",
  okay: "được",
  old: "già / cũ",
  on: "trên",
  once: "một lần",
  one: "một",
  only: "chỉ",
  open: "mở",
  or: "hoặc",
  orange: "cam / màu cam",
  order: "đặt hàng / thứ tự",
  other: "khác",
  our: "của chúng tôi",
  out: "ra ngoài",
  outside: "bên ngoài",
  over: "phía trên / hơn",
  own: "sở hữu / riêng",
  page: "trang",
  paint: "sơn / vẽ",
  pair: "một đôi",
  paper: "giấy",
  parent: "cha mẹ",
  park: "công viên / đỗ xe",
  part: "phần",
  party: "bữa tiệc",
  pass: "đi qua / vượt",
  past: "quá khứ",
  pay: "trả tiền",
  pen: "bút",
  people: "mọi người",
  perhaps: "có lẽ",
  person: "người",
  phone: "điện thoại",
  photo: "ảnh",
  piano: "đàn piano",
  picture: "bức tranh / ảnh",
  piece: "miếng / mảnh",
  place: "nơi",
  plan: "kế hoạch",
  plane: "máy bay",
  plant: "cây / trồng",
  play: "chơi",
  please: "làm ơn",
  police: "cảnh sát",
  polite: "lịch sự",
  pool: "hồ bơi",
  poor: "nghèo",
  popular: "phổ biến",
  possible: "có thể",
  post: "bưu điện / đăng",
  potato: "khoai tây",
  practice: "luyện tập",
  prefer: "thích hơn",
  prepare: "chuẩn bị",
  present: "hiện tại / món quà",
  pretty: "xinh / khá",
  price: "giá",
  probably: "có lẽ",
  problem: "vấn đề",
  product: "sản phẩm",
  program: "chương trình",
  project: "dự án",
  pull: "kéo",
  pupil: "học sinh",
  purple: "tím",
  push: "đẩy",
  put: "đặt",
  quarter: "một phần tư / quý",
  question: "câu hỏi",
  quick: "nhanh",
  quickly: "một cách nhanh chóng",
  quiet: "yên tĩnh",
  quite: "khá",
  radio: "radio",
  rain: "mưa",
  read: "đọc",
  ready: "sẵn sàng",
  real: "thật",
  really: "thật sự",
  reason: "lý do",
  red: "đỏ",
  remember: "nhớ",
  rent: "thuê",
  repeat: "lặp lại",
  rest: "nghỉ ngơi",
  restaurant: "nhà hàng",
  result: "kết quả",
  return: "trở về / trả lại",
  rice: "gạo / cơm",
  rich: "giàu",
  ride: "đi (xe / ngựa)",
  right: "phải / đúng",
  river: "sông",
  road: "đường",
  room: "phòng",
  round: "tròn / vòng",
  rule: "quy tắc",
  run: "chạy",
  sad: "buồn",
  safe: "an toàn",
  salad: "salad",
  salt: "muối",
  same: "giống nhau",
  Saturday: "Thứ Bảy",
  say: "nói",
  school: "trường học",
  science: "khoa học",
  sea: "biển",
  season: "mùa",
  seat: "chỗ ngồi",
  second: "thứ hai / giây",
  see: "nhìn thấy",
  seem: "dường như",
  sell: "bán",
  send: "gửi",
  sentence: "câu",
  seven: "bảy",
  seventeen: "mười bảy",
  seventy: "bảy mươi",
  several: "một vài",
  shall: "sẽ (trang trọng)",
  she: "cô ấy",
  sheep: "con cừu",
  ship: "tàu",
  shirt: "áo sơ mi",
  shoe: "giày",
  shop: "cửa hàng / mua sắm",
  short: "ngắn / thấp",
  should: "nên",
  show: "cho xem / buổi diễn",
  shower: "tắm vòi sen",
  sick: "ốm",
  side: "bên",
  similar: "tương tự",
  simple: "đơn giản",
  since: "kể từ / vì",
  sing: "hát",
  sister: "chị / em gái",
  sit: "ngồi",
  six: "sáu",
  sixteen: "mười sáu",
  sixty: "sáu mươi",
  size: "kích cỡ",
  skill: "kỹ năng",
  skirt: "váy",
  sky: "bầu trời",
  sleep: "ngủ",
  slow: "chậm",
  small: "nhỏ",
  smell: "ngửi / mùi",
  smile: "mỉm cười",
  smoke: "hút thuốc / khói",
  snow: "tuyết",
  so: "vậy / rất",
  some: "một số",
  somebody: "ai đó",
  someone: "ai đó",
  something: "một cái gì đó",
  sometimes: "thỉnh thoảng",
  son: "con trai",
  song: "bài hát",
  soon: "sớm",
  sorry: "xin lỗi",
  sound: "âm thanh / nghe có vẻ",
  south: "hướng nam",
  space: "không gian",
  speak: "nói",
  special: "đặc biệt",
  spell: "đánh vần",
  spend: "tiêu / dành",
  sport: "thể thao",
  spring: "mùa xuân / lò xo",
  square: "hình vuông / quảng trường",
  staff: "nhân viên",
  stand: "đứng",
  star: "ngôi sao",
  start: "bắt đầu",
  station: "nhà ga",
  stay: "ở lại",
  still: "vẫn / yên",
  stop: "dừng",
  store: "cửa hàng",
  story: "câu chuyện",
  street: "đường phố",
  strong: "mạnh",
  student: "học sinh / sinh viên",
  study: "học / nghiên cứu",
  stuff: "đồ đạc",
  subject: "môn học / chủ đề",
  success: "thành công",
  such: "như vậy",
  sugar: "đường",
  summer: "mùa hè",
  sun: "mặt trời",
  Sunday: "Chủ nhật",
  supermarket: "siêu thị",
  sure: "chắc chắn",
  surprise: "bất ngờ",
  sweet: "ngọt",
  swim: "bơi",
  table: "bàn",
  take: "lấy / mang",
  talk: "nói chuyện",
  tall: "cao",
  tea: "trà",
  teach: "dạy",
  teacher: "giáo viên",
  team: "đội",
  telephone: "điện thoại",
  television: "tivi",
  tell: "kể / bảo",
  ten: "mười",
  tennis: "quần vợt",
  than: "hơn",
  thank: "cảm ơn",
  thanks: "cảm ơn",
  that: "đó / rằng",
  the: "mạo từ xác định",
  their: "của họ",
  them: "họ (tân ngữ)",
  then: "sau đó",
  there: "ở đó",
  these: "những cái này",
  they: "họ",
  thing: "thứ / vật",
  think: "nghĩ",
  thirteen: "mười ba",
  thirty: "ba mươi",
  this: "này",
  those: "những cái đó",
  though: "dù",
  thousand: "một nghìn",
  three: "ba",
  through: "xuyên qua",
  Thursday: "Thứ Năm",
  ticket: "vé",
  time: "thời gian / lần",
  tired: "mệt",
  to: "đến / để",
  today: "hôm nay",
  together: "cùng nhau",
  toilet: "nhà vệ sinh",
  tomato: "cà chua",
  tomorrow: "ngày mai",
  tonight: "tối nay",
  too: "cũng / quá",
  tooth: "răng",
  top: "đỉnh / hàng đầu",
  total: "tổng",
  touch: "chạm",
  tour: "chuyến du lịch",
  town: "thị trấn",
  traffic: "giao thông",
  train: "tàu hỏa / luyện",
  travel: "du lịch",
  tree: "cây",
  trip: "chuyến đi",
  true: "đúng / thật",
  try: "thử",
  Tuesday: "Thứ Ba",
  turn: "rẽ / lượt",
  twelve: "mười hai",
  twenty: "hai mươi",
  twice: "hai lần",
  two: "hai",
  type: "loại / gõ",
  ugly: "xấu",
  under: "dưới",
  understand: "hiểu",
  university: "đại học",
  until: "cho đến khi",
  up: "lên",
  us: "chúng tôi (tân ngữ)",
  use: "dùng",
  useful: "hữu ích",
  usually: "thường thường",
  vacation: "kỳ nghỉ",
  vegetable: "rau",
  very: "rất",
  video: "video",
  village: "làng",
  visit: "thăm",
  voice: "giọng nói",
  wait: "đợi",
  wake: "thức dậy",
  walk: "đi bộ",
  wall: "bức tường",
  want: "muốn",
  warm: "ấm",
  wash: "rửa",
  watch: "xem / đồng hồ đeo tay",
  water: "nước",
  way: "cách / đường",
  we: "chúng tôi",
  weak: "yếu",
  wear: "mặc / đeo",
  weather: "thời tiết",
  website: "trang web",
  Wednesday: "Thứ Tư",
  week: "tuần",
  weekend: "cuối tuần",
  welcome: "chào mừng",
  well: "tốt / giếng",
  west: "hướng tây",
  what: "gì",
  when: "khi nào",
  where: "ở đâu",
  which: "cái nào",
  while: "trong khi",
  white: "trắng",
  who: "ai",
  why: "tại sao",
  wife: "vợ",
  will: "sẽ",
  win: "thắng",
  wind: "gió",
  window: "cửa sổ",
  wine: "rượu vang",
  winter: "mùa đông",
  with: "với",
  without: "không có",
  woman: "phụ nữ",
  wonderful: "tuyệt vời",
  word: "từ",
  work: "làm việc / công việc",
  world: "thế giới",
  worry: "lo lắng",
  worse: "tệ hơn",
  worst: "tệ nhất",
  would: "sẽ (giả định)",
  write: "viết",
  wrong: "sai",
  year: "năm",
  yellow: "vàng",
  yes: "có / vâng",
  yesterday: "hôm qua",
  yet: "chưa / vậy mà",
  you: "bạn",
  young: "trẻ",
  your: "của bạn",
  yourself: "bản thân bạn",
  zero: "số không",

  // common JLPT N5 English glosses
  "to meet": "gặp / gặp gỡ",
  "to see": "nhìn thấy / gặp",
  "to go": "đi",
  "to come": "đến",
  "to do": "làm",
  "to make": "làm / tạo",
  "to eat": "ăn",
  "to drink": "uống",
  "to read": "đọc",
  "to write": "viết",
  "to speak": "nói",
  "to listen": "nghe",
  "to hear": "nghe thấy",
  "to say": "nói",
  "to think": "nghĩ",
  "to know": "biết",
  "to understand": "hiểu",
  "to learn": "học",
  "to study": "học / nghiên cứu",
  "to teach": "dạy",
  "to buy": "mua",
  "to sell": "bán",
  "to give": "cho",
  "to take": "lấy / mang",
  "to bring": "mang đến",
  "to put": "đặt",
  "to use": "dùng",
  "to open": "mở",
  "to close": "đóng",
  "to enter": "vào",
  "to exit": "ra",
  "to leave": "rời đi",
  "to return": "trở về",
  "to begin": "bắt đầu",
  "to start": "bắt đầu",
  "to finish": "kết thúc",
  "to end": "kết thúc",
  "to live": "sống",
  "to work": "làm việc",
  "to play": "chơi",
  "to sleep": "ngủ",
  "to wake up": "thức dậy",
  "to rest": "nghỉ",
  "to wait": "đợi",
  "to stand": "đứng",
  "to sit": "ngồi",
  "to walk": "đi bộ",
  "to run": "chạy",
  "to swim": "bơi",
  "to fly": "bay",
  "to ride": "cưỡi / đi (xe)",
  "to drive": "lái xe",
  "to get on": "lên (xe)",
  "to get off": "xuống (xe)",
  "to wear": "mặc / đeo",
  "to take off": "cởi / cất cánh",
  "to wash": "rửa",
  "to clean": "dọn / lau",
  "to cut": "cắt",
  "to break": "làm vỡ / nghỉ",
  "to fix": "sửa",
  "to help": "giúp",
  "to ask": "hỏi",
  "to answer": "trả lời",
  "to call": "gọi",
  "to send": "gửi",
  "to receive": "nhận",
  "to show": "cho xem",
  "to look": "nhìn",
  "to watch": "xem",
  "to like": "thích",
  "to love": "yêu",
  "to hate": "ghét",
  "to want": "muốn",
  "to need": "cần",
  "to can": "có thể",
  "to be able to": "có thể",
  "to exist": "tồn tại / có",
  "there is": "có (vật)",
  "there are": "có (nhiều)",
  "I": "tôi",
  "you": "bạn",
  "person": "người",
  "people": "người / mọi người",
  "time": "thời gian",
  "day": "ngày",
  "today": "hôm nay",
  "tomorrow": "ngày mai",
  "yesterday": "hôm qua",
  "morning": "buổi sáng",
  "night": "đêm",
  "week": "tuần",
  "month": "tháng",
  "year": "năm",
  "now": "bây giờ",
  "here": "ở đây",
  "there": "ở đó",
  "where": "ở đâu",
  "when": "khi nào",
  "what": "cái gì",
  "who": "ai",
  "why": "tại sao",
  "how": "như thế nào",
  "this": "cái này",
  "that": "cái đó",
  "big": "to / lớn",
  "small": "nhỏ",
  "new": "mới",
  "old": "cũ / già",
  "good": "tốt",
  "bad": "xấu",
  "hot": "nóng",
  "cold": "lạnh",
  "expensive": "đắt",
  "cheap": "rẻ",
  "delicious": "ngon",
  "fun": "vui",
  "interesting": "thú vị",
  "difficult": "khó",
  "easy": "dễ",
  "beautiful": "đẹp",
  "busy": "bận",
  "free": "rảnh / miễn phí",
  "happy": "vui / hạnh phúc",
  "sad": "buồn",
  "tired": "mệt",
  "hungry": "đói",
  "thirsty": "khát",
  "as for; marks the topic of the sentence": "đánh dấu chủ đề câu (topic)",
  "marks the topic of the sentence": "đánh dấu chủ đề câu",
  "as for": "còn về / về phần",
  "Copula present": "Động từ to be thì hiện tại (am/is/are)",
};

const GRAMMAR_OVERRIDE = {
  "oj-wa": {
    vi: "〜は — đánh dấu chủ đề câu (topic)",
    noteVi: "Danh từ + は · viết は nhưng đọc «wa». Nói về chủ đề; thông tin chính đi sau.",
  },
  "g-en-1": {
    vi: "be (am/is/are) — thì / là hiện tại",
    noteVi: "I + am · you/we/they + are · he/she/it + is",
  },
};

function loadJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), "utf8"));
}

function loadCache() {
  if (!existsSync(cachePath)) return {};
  try {
    return JSON.parse(readFileSync(cachePath, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(cache, null, 0));
}

function normalizeKey(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function lookupOverride(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  if (OVERRIDE[raw]) return OVERRIDE[raw];
  const low = normalizeKey(raw);
  if (OVERRIDE[low]) return OVERRIDE[low];
  // strip leading "to "
  if (/^to\s+/i.test(raw)) {
    const rest = raw.replace(/^to\s+/i, "").trim();
    if (OVERRIDE[rest]) return OVERRIDE[normalizeKey(rest)] || OVERRIDE[rest];
    if (OVERRIDE[normalizeKey(rest)]) return OVERRIDE[normalizeKey(rest)];
  }
  return null;
}

function cleanMt(text, source) {
  let t = String(text || "").trim();
  if (!t) return null;
  if (/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID LANGUAGE/i.test(t)) return null;
  if (/\[object |HTMLTextArea/i.test(t)) return null;
  // Fix common "to X" → "để ..."
  if (/^to\s+/i.test(source) && /^để\s+/i.test(t)) {
    t = t.replace(/^để\s+/i, "").trim();
  }
  return t || null;
}

async function translateEnViOnce(text, cache) {
  const src = String(text || "").trim();
  if (!src) return null;
  const ov = lookupOverride(src);
  if (ov) return ov;

  let query = src;
  if (/^to\s+[a-z]/i.test(src)) {
    query = src.replace(/^to\s+/i, "").trim();
    const ov2 = lookupOverride(query);
    if (ov2) return ov2;
  }

  const cacheKey = normalizeKey(query);
  if (cache[cacheKey]) return cache[cacheKey];

  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(query.slice(0, 450)) +
    "&langpair=en|vi";
  const res = await fetch(url);
  const j = await res.json();
  if (j?.quotaFinished) {
    const err = new Error("MyMemory quota finished");
    err.code = "QUOTA";
    throw err;
  }
  const primary = cleanMt(j?.responseData?.translatedText, src);
  const matches = Array.isArray(j?.matches) ? j.matches : [];
  let best = primary;
  for (const m of matches) {
    const cand = cleanMt(m?.translation, src);
    if (!cand) continue;
    const q = Number(m.quality) || 0;
    const match = Number(m.match) || 0;
    if (q >= 70 && match >= 0.85) {
      best = cand;
      break;
    }
  }
  if (best) {
    cache[cacheKey] = best;
    return best;
  }
  return null;
}

async function translateEnVi(text, cache) {
  let delay = 400;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await translateEnViOnce(text, cache);
    } catch (e) {
      console.warn(`MT fail attempt ${attempt}:`, e.message);
      if (e.code === "QUOTA" && attempt === 3) throw e;
      await sleep(delay);
      delay *= 2;
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function posHint(pos) {
  if (!pos) return null;
  const key = String(pos).trim().toLowerCase().split(/[,/]/)[0];
  return POS_VI[key] || null;
}

const JP_LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const EN_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const JP_SEED_FILES = {
  N5: "src/data/openjlpt-n5-seed.json",
  N4: "src/data/openjlpt-n4-seed.json",
  N3: "src/data/openjlpt-n3-seed.json",
  N2: "src/data/openjlpt-n2-seed.json",
  N1: "src/data/openjlpt-n1-seed.json",
};

function parseArgs(argv) {
  const out = {
    jp: [],
    en: [],
    grammarOnly: false,
    force: false,
    allRemaining: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--jp" && argv[i + 1]) {
      out.jp = argv[++i]
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((l) => JP_LEVELS.includes(l));
    } else if (a === "--en" && argv[i + 1]) {
      out.en = argv[++i]
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((l) => EN_LEVELS.includes(l));
    } else if (a === "--grammar-only") {
      out.grammarOnly = true;
    } else if (a === "--force") {
      out.force = true;
    } else if (a === "--all-remaining") {
      out.allRemaining = true;
    }
  }
  return out;
}

function hasGloss(map, id) {
  return Boolean(map[id]?.vi?.trim());
}

function loadGlossMap(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

function writeGlossMap(rel, data) {
  writeFileSync(join(root, rel), JSON.stringify(data) + "\n");
}

async function glossJpWord(w, cache) {
  const enMeaning = (w.meanings && w.meanings[0]) || w.word;
  let vi = await translateEnVi(enMeaning, cache);
  if (!vi) vi = await translateEnVi(w.romaji || w.word, cache);
  if (!vi) vi = `(${enMeaning})`;
  return { vi };
}

async function glossEnWord(w, cache) {
  const word = w.word;
  let vi = lookupOverride(word) || lookupOverride(normalizeKey(word));
  if (!vi) vi = await translateEnVi(word, cache);
  if (!vi) {
    const raw = (w.meanings || []).find(
      (m) =>
        m &&
        m !== w.word &&
        !/^EN ·/i.test(m) &&
        !/^CEFR /i.test(m) &&
        normalizeKey(m) !== normalizeKey(w.pos || ""),
    );
    if (raw && !POS_VI[normalizeKey(raw)]) vi = await translateEnVi(raw, cache);
  }
  if (!vi) {
    const ph = posHint(w.pos);
    vi = ph ? `${word} (${ph})` : word;
  }
  return { vi };
}

async function glossGrammar(g, cache, track) {
  if (GRAMMAR_OVERRIDE[g.id]) return GRAMMAR_OVERRIDE[g.id];
  if (track === "jp") {
    const vi = (await translateEnVi(g.meaning, cache)) || g.meaning;
    const noteVi = g.note
      ? (await translateEnVi(g.note.split("·")[0].trim(), cache)) || undefined
      : undefined;
    return noteVi ? { vi, noteVi } : { vi };
  }
  const vi =
    (await translateEnVi(g.meaning, cache)) ||
    (await translateEnVi(g.pattern, cache)) ||
    g.meaning;
  const noteVi = g.note
    ? (await translateEnVi(String(g.note).slice(0, 200), cache)) || undefined
    : undefined;
  return noteVi ? { vi, noteVi } : { vi };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cache = loadCache();

  const glossJp = loadGlossMap("src/data/gloss-vi-jp.json");
  const glossEn = loadGlossMap("src/data/gloss-vi-en.json");
  const glossGJp = loadGlossMap("src/data/gloss-vi-grammar-jp.json");
  const glossGEn = loadGlossMap("src/data/gloss-vi-grammar-en.json");

  let jpLevels = args.jp;
  let enLevels = args.en;

  if (args.allRemaining) {
    jpLevels = JP_LEVELS.filter((lv) => {
      const words = loadJson(JP_SEED_FILES[lv]);
      return words.some((w) => !hasGloss(glossJp, w.id));
    });
    const enAll = loadJson("src/data/cefrj-vocab-seed.json");
    enLevels = EN_LEVELS.filter((lv) =>
      enAll.some(
        (w) =>
          String(w.level || "").toUpperCase() === lv && !hasGloss(glossEn, w.id),
      ),
    );
    // Always include grammar gaps for selected + any missing grammar levels
    const gJpAll = loadJson("src/data/grammar-jp.json");
    const gEnAll = loadJson("src/data/grammar-en.json");
    for (const lv of JP_LEVELS) {
      if (
        gJpAll.some(
          (g) =>
            String(g.level || "").toUpperCase() === lv &&
            !hasGloss(glossGJp, g.id),
        ) &&
        !jpLevels.includes(lv)
      ) {
        jpLevels.push(lv);
      }
    }
    for (const lv of EN_LEVELS) {
      if (
        gEnAll.some(
          (g) =>
            String(g.level || "").toUpperCase() === lv &&
            !hasGloss(glossGEn, g.id),
        ) &&
        !enLevels.includes(lv)
      ) {
        enLevels.push(lv);
      }
    }
  }

  if (!jpLevels.length && !enLevels.length) {
    console.error(
      "Usage: --jp N4,N3 --en A2,B1 | --all-remaining [--grammar-only] [--force]",
    );
    process.exit(1);
  }

  const enAll = loadJson("src/data/cefrj-vocab-seed.json");
  const grammarJpAll = loadJson("src/data/grammar-jp.json");
  const grammarEnAll = loadJson("src/data/grammar-en.json");

  const jpWords = [];
  if (!args.grammarOnly) {
    for (const lv of jpLevels) {
      jpWords.push(...loadJson(JP_SEED_FILES[lv]));
    }
  }
  const enWords = args.grammarOnly
    ? []
    : enAll.filter((w) => enLevels.includes(String(w.level || "").toUpperCase()));
  const grammarJp = grammarJpAll.filter((g) =>
    jpLevels.includes(String(g.level || "").toUpperCase()),
  );
  const grammarEn = grammarEnAll.filter((g) =>
    enLevels.includes(String(g.level || "").toUpperCase()),
  );

  const jpTodo = args.force
    ? jpWords
    : jpWords.filter((w) => !hasGloss(glossJp, w.id));
  const enTodo = args.force
    ? enWords
    : enWords.filter((w) => !hasGloss(glossEn, w.id));
  const gJpTodo = args.force
    ? grammarJp
    : grammarJp.filter((g) => !hasGloss(glossGJp, g.id));
  const gEnTodo = args.force
    ? grammarEn
    : grammarEn.filter((g) => !hasGloss(glossGEn, g.id));

  const total = jpTodo.length + enTodo.length + gJpTodo.length + gEnTodo.length;
  console.log(
    `Levels JP [${jpLevels.join(",")}] EN [${enLevels.join(",")}]` +
      (args.grammarOnly ? " grammar-only" : "") +
      (args.force ? " force" : ""),
  );
  console.log(
    `Todo: JP vocab ${jpTodo.length}/${jpWords.length}, EN vocab ${enTodo.length}/${enWords.length}, G-JP ${gJpTodo.length}, G-EN ${gEnTodo.length} (total ${total})`,
  );

  if (!total) {
    console.log("Nothing to do — all selected ids already glossed.");
    return;
  }

  let done = 0;
  const tick = () => {
    done++;
    if (done % 50 === 0 || done === total) {
      saveCache(cache);
      writeGlossMap("src/data/gloss-vi-jp.json", glossJp);
      writeGlossMap("src/data/gloss-vi-en.json", glossEn);
      writeGlossMap("src/data/gloss-vi-grammar-jp.json", glossGJp);
      writeGlossMap("src/data/gloss-vi-grammar-en.json", glossGEn);
      console.log(`… ${done}/${total}`);
    }
  };

  for (const w of jpTodo) {
    glossJp[w.id] = await glossJpWord(w, cache);
    tick();
    await sleep(100);
  }
  for (const w of enTodo) {
    glossEn[w.id] = await glossEnWord(w, cache);
    tick();
    await sleep(80);
  }
  for (const g of gJpTodo) {
    glossGJp[g.id] = await glossGrammar(g, cache, "jp");
    tick();
    await sleep(90);
  }
  for (const g of gEnTodo) {
    glossGEn[g.id] = await glossGrammar(g, cache, "en");
    tick();
    await sleep(90);
  }

  saveCache(cache);
  writeGlossMap("src/data/gloss-vi-jp.json", glossJp);
  writeGlossMap("src/data/gloss-vi-en.json", glossEn);
  writeGlossMap("src/data/gloss-vi-grammar-jp.json", glossGJp);
  writeGlossMap("src/data/gloss-vi-grammar-en.json", glossGEn);

  console.log(
    `Done. Totals JP ${Object.keys(glossJp).length}, EN ${Object.keys(glossEn).length}, G-JP ${Object.keys(glossGJp).length}, G-EN ${Object.keys(glossGEn).length}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
