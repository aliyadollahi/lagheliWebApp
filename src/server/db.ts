import Database from 'better-sqlite3';
import path from 'path';
import type {EcosystemConfig, GemStoreOffer} from '../shared/types.ts';

const DB_PATH = process.env.SQLITE_PATH || path.resolve(process.cwd(), 'lagheli.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const DEFAULT_ECOSYSTEM_CONFIG: EcosystemConfig = {
  marketplaceTabEnabled: true,
  marketplaceTitle: 'بازارچه و اصناف',
  exploreShowcaseEnabled: true,
  recipeContextEnabled: true,
  shoppingDeliveryCardEnabled: true,
  maxPartnerCardsPerRecipe: 1,
  enabledPartnerRoles: [
    'food_brands',
    'kitchen_equipment',
    'stores_supermarkets',
    'restaurants_kitchens',
    'cafes_bakeries',
    'chefs_nutritionists',
    'culinary_schools',
    'local_artisans',
    'catering_events',
    'instant_delivery',
  ],
  activeCampaignTitle: 'همکاران منتخب فصل پاییز لاقلی',
};

export const GEM_STORE_OFFERS: GemStoreOffer[] = [
  {
    id: 'offer-zafaran',
    title: 'تخفیف ۱۵٪ زعفران سرگل قائنات',
    partnerName: 'خانه زعفران خراسان',
    discountLabel: '۱۵٪ تخفیف خرید اول',
    gemCost: 60,
    codePrefix: 'ZAF',
  },
  {
    id: 'offer-castiron',
    title: 'کوپن ۱۲۰٬۰۰۰ تومانی ظروف چدنی دست‌ساز',
    partnerName: 'کارگاه ظروف چدنی رَست',
    discountLabel: '۱۲۰٬۰۰۰ تومان تخفیف',
    gemCost: 90,
    codePrefix: 'RST',
  },
  {
    id: 'offer-express',
    title: 'ارسال رایگان خرید مواد تازه (۲ نوبت)',
    partnerName: 'پیک سبز لاقلی',
    discountLabel: 'ارسال رایگان فوری',
    gemCost: 45,
    codePrefix: 'EXP',
  },
  {
    id: 'offer-order',
    title: 'کوپن ۸۰٬۰۰۰ تومانی سفارش غذای روز',
    partnerName: 'سفره ادیتوریال لاقلی',
    discountLabel: '۸۰٬۰۰۰ تومان تخفیف سفارش',
    gemCost: 75,
    codePrefix: 'LAG',
  },
];

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT 'تهران',
      neighborhood TEXT NOT NULL DEFAULT 'ونک',
      bio TEXT NOT NULL DEFAULT '',
      specialty TEXT NOT NULL DEFAULT 'آشپزی اصیل ایرانی',
      is_verified_chef INTEGER NOT NULL DEFAULT 0,
      chef_verification_status TEXT NOT NULL DEFAULT 'none',
      role TEXT NOT NULL DEFAULT 'user',
      xp INTEGER NOT NULL DEFAULT 60,
      gems INTEGER NOT NULL DEFAULT 120,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      phone TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS admin_auth (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      category TEXT NOT NULL,
      region TEXT NOT NULL,
      season TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      diet_tags_json TEXT NOT NULL,
      prep_minutes INTEGER NOT NULL,
      cook_minutes INTEGER NOT NULL,
      servings INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      nutrition_json TEXT NOT NULL,
      is_vip INTEGER NOT NULL DEFAULT 0,
      vip_gem_cost INTEGER NOT NULL DEFAULT 0,
      parent_recipe_id TEXT,
      variation_note TEXT,
      author_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      ingredients_json TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      tools_json TEXT NOT NULL,
      linked_menu_dish_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      user_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, recipe_id)
    );

    CREATE TABLE IF NOT EXISTS unlocked_recipes (
      user_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, recipe_id)
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (follower_id, following_id)
    );

    CREATE TABLE IF NOT EXISTS recipe_questions (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      solved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_answers (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_verified INTEGER NOT NULL DEFAULT 0,
      body TEXT NOT NULL,
      upvotes INTEGER NOT NULL DEFAULT 0,
      is_best INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shopping_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      canonical_name TEXT NOT NULL,
      amount REAL NOT NULL,
      unit TEXT NOT NULL,
      category TEXT NOT NULL,
      recipe_id TEXT,
      recipe_title TEXT,
      checked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      story TEXT NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL,
      chef_name TEXT NOT NULL,
      chef_verified INTEGER NOT NULL DEFAULT 1,
      prep_minutes INTEGER NOT NULL,
      calories INTEGER NOT NULL,
      single_price INTEGER NOT NULL,
      double_price INTEGER NOT NULL,
      diet_tags_json TEXT NOT NULL,
      key_ingredients_json TEXT NOT NULL,
      featured INTEGER NOT NULL DEFAULT 0,
      linked_recipe_id TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      tracking_code TEXT UNIQUE NOT NULL,
      city TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      delivery_slot TEXT NOT NULL,
      note TEXT,
      items_json TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      packaging_fee INTEGER NOT NULL,
      delivery_fee INTEGER NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role_type TEXT NOT NULL,
      city TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      description TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      website TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      claim_status TEXT NOT NULL DEFAULT 'verified',
      tier TEXT NOT NULL DEFAULT 'free',
      promo_code TEXT,
      promo_label TEXT,
      affiliate_code TEXT,
      related_ingredients_json TEXT NOT NULL,
      related_tools_json TEXT NOT NULL,
      catalog_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'approved',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partner_follows (
      user_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, partner_id)
    );

    CREATE TABLE IF NOT EXISTS partner_events (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gem_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_coupons (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      code TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      discount_label TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_photos (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      image_url TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      is_cover INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,
      account_type TEXT NOT NULL,
      account_id TEXT NOT NULL,
      account_name TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sponsor_campaigns (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      placement TEXT NOT NULL,
      promo_code TEXT,
      cta_label TEXT NOT NULL DEFAULT 'مشاهده پیشنهاد',
      budget_toman INTEGER NOT NULL DEFAULT 0,
      spent_toman INTEGER NOT NULL DEFAULT 0,
      impressions INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      starts_at TEXT,
      ends_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  ensureSchemaUpgrades();
  seedInitialData();
  seedV2Content();
}

function ensureColumn(table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as {name: string}[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function ensureSchemaUpgrades(): void {
  ensureColumn('users', 'wallet_balance', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'is_suspended', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('recipes', 'photo_credit_name', 'TEXT');
  ensureColumn('partners', 'business_balance', 'INTEGER NOT NULL DEFAULT 0');
}

export function getEcosystemConfig(): EcosystemConfig {
  const row = db
    .prepare('SELECT value_json FROM app_config WHERE key = ?')
    .get('ecosystem') as {value_json: string} | undefined;
  if (!row) {
    db.prepare('INSERT OR REPLACE INTO app_config (key, value_json) VALUES (?, ?)').run(
      'ecosystem',
      JSON.stringify(DEFAULT_ECOSYSTEM_CONFIG)
    );
    return DEFAULT_ECOSYSTEM_CONFIG;
  }
  return {...DEFAULT_ECOSYSTEM_CONFIG, ...JSON.parse(row.value_json)};
}

function seedInitialData(): void {
  const existingRecipes = db.prepare('SELECT COUNT(*) as count FROM recipes').get() as {count: number};
  if (existingRecipes.count > 0) return;

  const now = new Date().toISOString();

  // Ensure default config exists
  db.prepare('INSERT OR IGNORE INTO app_config (key, value_json) VALUES (?, ?)').run(
    'ecosystem',
    JSON.stringify(DEFAULT_ECOSYSTEM_CONFIG)
  );

  // Seed Verified Chefs
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, phone, name, city, neighborhood, bio, specialty, is_verified_chef, chef_verification_status, role, xp, gems, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'chef-mahsa',
    '09120001001',
    'سرآشپز مهسا رادمنش',
    'تهران',
    'جردن',
    'پژوهشگر آشپزی اصیل ایرانی و نویسنده کتاب‌های طعم‌های آرام خانه.',
    'پلوهای مجلسی و ته‌چین',
    1,
    'approved',
    'chef',
    1380,
    340,
    now
  );
  insertUser.run(
    'chef-kaveh',
    '09120001002',
    'سرآشپز کاوه گیلانی',
    'رشت',
    'گلسار',
    'متخصص آشپزی بومی گیلان و غذاهای فصلی با مواد تازه محلی.',
    'غذاهای شمالی و گیاهی',
    1,
    'approved',
    'chef',
    920,
    210,
    now
  );
  insertUser.run(
    'chef-sara',
    '09120001003',
    'سارا فرهادی',
    'شیراز',
    'معالی‌آباد',
    'علاقه‌مند به خورشت‌های جاافتاده، آش‌های سنتی و نسخه سبک غذاهای ایرانی.',
    'خورشت و آش‌های اصیل',
    1,
    'approved',
    'chef',
    760,
    180,
    now
  );

  // Seed Follows between chefs
  const insertFollow = db.prepare(
    'INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)'
  );
  insertFollow.run('chef-kaveh', 'chef-mahsa', now);
  insertFollow.run('chef-sara', 'chef-mahsa', now);
  insertFollow.run('chef-mahsa', 'chef-kaveh', now);
  insertFollow.run('chef-sara', 'chef-kaveh', now);
  insertFollow.run('chef-mahsa', 'chef-sara', now);

  // Image paths generated via generate_image
  const IMG_TAHCHIN = '/src/assets/images/hero_tahchin_saffron_1795554313371.jpg';
  const IMG_FESENJAN = '/src/assets/images/dish_fesenjan_editorial_1795554313427.jpg';
  const IMG_MIRZA = '/src/assets/images/dish_mirza_ghasemi_1795554314673.jpg';
  const IMG_BAGHALI = '/src/assets/images/dish_baghali_polo_1795554313137.jpg';
  const IMG_ASH = '/src/assets/images/dish_ash_reshteh_1795554316371.jpg';

  const insertRecipe = db.prepare(`
    INSERT INTO recipes (
      id, slug, title, subtitle, description, image_url, category, region, season, meal_type,
      diet_tags_json, prep_minutes, cook_minutes, servings, difficulty, nutrition_json,
      is_vip, vip_gem_cost, parent_recipe_id, variation_note, author_id, status,
      ingredients_json, steps_json, tools_json, linked_menu_dish_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertRecipe.run(
    'rec-tahchin',
    'saffron-tahchin-morgh',
    'ته‌چین زعفرانی مرغ با زرشک و خلال پسته',
    'پوسته طلایی برشته با بافت نرم ماست چکیده و عطر زعفران قائنات',
    'ته‌چین اصیل تهرانی با توازن دقیق زرده تخم‌مرغ، ماست چکیده پرچرب و زعفران غلیظ که هم روی شعله ملایم و هم در فر به پوسته‌ای یکدست و طلایی می‌رسد.',
    IMG_TAHCHIN,
    'ناهار و شام',
    'تهران',
    'چهارفصل',
    'ناهار',
    JSON.stringify(['سنتی', 'پرپروتئین', 'بدون گلوتن']),
    30,
    60,
    4,
    'متوسط',
    JSON.stringify({calories: 560, protein: 34, carbs: 58, fat: 21, fiber: 3}),
    0,
    0,
    null,
    null,
    'chef-mahsa',
    'published',
    JSON.stringify([
      {name: 'برنج ایرانی', amount: 3, unit: 'پیمانه'},
      {name: 'سینه مرغ', amount: 450, unit: 'گرم'},
      {name: 'ماست چکیده', amount: 1.5, unit: 'پیمانه'},
      {name: 'تخم‌مرغ', amount: 2, unit: 'عدد'},
      {name: 'زعفران دم‌کرده', amount: 4, unit: 'قاشق غذاخوری'},
      {name: 'زرشک', amount: 3, unit: 'قاشق غذاخوری'},
      {name: 'خلال پسته', amount: 2, unit: 'قاشق غذاخوری'},
      {name: 'کره', amount: 40, unit: 'گرم'},
      {name: 'پیاز', amount: 1, unit: 'عدد'},
      {name: 'نمک', amount: 1, unit: 'قاشق چای‌خوری'},
    ]),
    JSON.stringify([
      {
        order: 1,
        instruction: 'برنج ایرانی را با آب ولرم و نمک از دو ساعت قبل خیس کنید، سپس در آب جوش بریزید و کمی زنده‌تر از حالت معمول آبکش کنید.',
        timerMinutes: 10,
        highlightIngredients: ['برنج ایرانی', 'نمک'],
      },
      {
        order: 2,
        instruction: 'سینه مرغ را همراه با پیاز خردشده، برگ بو، کمی زردچوبه و نمک بپزید و پس از خنک شدن به‌صورت ریش‌ریش درشت آماده کنید.',
        timerMinutes: 35,
        highlightIngredients: ['سینه مرغ', 'پیاز'],
      },
      {
        order: 3,
        instruction: 'زرده تخم‌مرغ‌ها، ماست چکیده، ۳ قاشق زعفران دم‌کرده و نصف کره ذوب‌شده را آرام هم بزنید تا مایه‌ای یکدست و خوش‌رنگ بسازید، سپس نیمی از برنج را با آن مخلوط کنید.',
        highlightIngredients: ['ماست چکیده', 'تخم‌مرغ', 'زعفران دم‌کرده', 'کره'],
      },
      {
        order: 4,
        instruction: 'کف قابلمه نچسب یا ظرف چدنی را چرب کنید، لایه اول برنج زعفرانی را فشرده بچینید، مرغ و بخشی از زرشک تفت‌داده را وسط قرار دهید و بقیه برنج را روی آن ببندید.',
        highlightIngredients: ['زرشک', 'خلال پسته'],
      },
      {
        order: 5,
        instruction: 'روی شعله بسیار ملایم با دم‌کنی یا در فر ۱۸۰ درجه بپزید تا دیواره‌ها طلایی و برشته شوند. هنگام سرو با زرشک و خلال پسته بیارایید.',
        timerMinutes: 50,
        highlightIngredients: ['زرشک', 'خلال پسته'],
      },
    ]),
    JSON.stringify(['قابلمه چدنی', 'فر', 'زعفران‌ساب']),
    'dish-tahchin',
    now
  );

  insertRecipe.run(
    'rec-fesenjan',
    'khoresh-fesenjan-malas',
    'خورشت فسنجان ملس با گردوی بوداده و رب انار گیلان',
    'روغن‌اندازی طبیعی گردو با پخت آهسته و توازن دقیق ترشی و شیرینی',
    'نسخه‌ای آرام و شفاف از فسنجان اصیل شمالی؛ با تفت ملایم مغز گردو و شوک آب سرد برای رسیدن به بافتی مخملی و براق بدون نیاز به روغن اضافه.',
    IMG_FESENJAN,
    'ناهار و شام',
    'گیلان',
    'پاییز',
    'شام',
    JSON.stringify(['سنتی', 'بدون گلوتن']),
    20,
    120,
    4,
    'حرفه‌ای',
    JSON.stringify({calories: 620, protein: 28, carbs: 32, fat: 42, fiber: 5}),
    0,
    0,
    null,
    null,
    'chef-kaveh',
    'published',
    JSON.stringify([
      {name: 'مغز گردو', amount: 300, unit: 'گرم'},
      {name: 'سینه مرغ', amount: 500, unit: 'گرم'},
      {name: 'رب انار', amount: 4, unit: 'قاشق غذاخوری'},
      {name: 'پیاز', amount: 1, unit: 'عدد'},
      {name: 'دانه انار', amount: 3, unit: 'قاشق غذاخوری'},
      {name: 'زعفران دم‌کرده', amount: 2, unit: 'قاشق غذاخوری'},
      {name: 'شکر', amount: 1, unit: 'قاشق غذاخوری', optional: true},
    ]),
    JSON.stringify([
      {
        order: 1,
        instruction: 'مغز گردو را دو بار آسیاب کنید تا نرم و نیمه‌خمیری شود، سپس در قابلمه چدنی روی حرارت بسیار کم ۳ دقیقه تفت دهید تا عطرش آزاد شود.',
        timerMinutes: 4,
        highlightIngredients: ['مغز گردو'],
      },
      {
        order: 2,
        instruction: '۳ لیوان آب سرد به گردو اضافه کنید و اجازه دهید با شعله ملایم بجوشد و به‌تدریج روغن بیندازد.',
        timerMinutes: 60,
        highlightIngredients: ['مغز گردو'],
      },
      {
        order: 3,
        instruction: 'پیاز رنده‌شده را سبک تفت دهید، تکه‌های مرغ را با زردچوبه و زعفران مزه دار کرده و به خورشت اضافه کنید.',
        timerMinutes: 35,
        highlightIngredients: ['پیاز', 'سینه مرغ', 'زعفران دم‌کرده'],
      },
      {
        order: 4,
        instruction: 'رب انار ملس را بیفزایید و در صورت تمایل میزان ترشی را با کمی شکر تنظیم کنید. نیم ساعت آخر درِ قابلمه را نیمه‌باز بگذارید تا جا بیفتد و با دانه انار سرو کنید.',
        timerMinutes: 25,
        highlightIngredients: ['رب انار', 'دانه انار'],
      },
    ]),
    JSON.stringify(['قابلمه چدنی', 'آسیاب']),
    'dish-fesenjan',
    now
  );

  insertRecipe.run(
    'rec-mirza',
    'mirza-ghasemi-smoked',
    'میرزاقاسمی دودی رشتی با نان سنگک داغ',
    'عطر بادمجان کبابی روی آتش، سیر تازه و گوجه‌فرنگی رسیده در ۳۵ دقیقه',
    'یک وعده گیاهی سریع، سبک و سرشار از طعم اصیل شمال ایران که برای صبحانه دیرهنگام، پیش‌غذا یا شام سبک ایده‌آل است.',
    IMG_MIRZA,
    'پخت سریع',
    'گیلان',
    'تابستان',
    'شام',
    JSON.stringify(['گیاهی', 'رژیمی', 'سریع', 'بدون گلوتن']),
    10,
    25,
    3,
    'آسان',
    JSON.stringify({calories: 290, protein: 12, carbs: 24, fat: 16, fiber: 7}),
    0,
    0,
    null,
    null,
    'chef-kaveh',
    'published',
    JSON.stringify([
      {name: 'بادمجان', amount: 4, unit: 'عدد'},
      {name: 'گوجه', amount: 3, unit: 'عدد'},
      {name: 'سیر', amount: 5, unit: 'حبه'},
      {name: 'تخم‌مرغ', amount: 2, unit: 'عدد'},
      {name: 'روغن زیتون', amount: 3, unit: 'قاشق غذاخوری'},
      {name: 'زردچوبه', amount: 0.5, unit: 'قاشق چای‌خوری'},
      {name: 'نمک', amount: 1, unit: 'قاشق چای‌خوری'},
    ]),
    JSON.stringify([
      {
        order: 1,
        instruction: 'بادمجان‌ها را مستقیم روی شعله یا در فر گریل کنید تا پوستشان کاملاً بسوزد و مغزشان نرم و دودی شود؛ سپس پوست بگیرید و ساطوری کنید.',
        timerMinutes: 12,
        highlightIngredients: ['بادمجان'],
      },
      {
        order: 2,
        instruction: 'سیر خردشده را با روغن زیتون و زردچوبه ۱ دقیقه تفت دهید تا عطرش بلند شود، سپس گوجه‌های پوست‌گرفته و خردشده را اضافه کنید تا آبش کشیده شود.',
        timerMinutes: 8,
        highlightIngredients: ['سیر', 'روغن زیتون', 'گوجه', 'زردچوبه'],
      },
      {
        order: 3,
        instruction: 'بادمجان ساطوری را اضافه کنید و ۵ دقیقه با هم تفت دهید. در پایان تخم‌مرغ‌ها را روی غذا بشکنید و پس از بسته‌شدن سرو کنید.',
        timerMinutes: 6,
        highlightIngredients: ['تخم‌مرغ'],
      },
    ]),
    JSON.stringify(['تابه چدنی', 'شعله‌خشک‌کن']),
    'dish-mirza',
    now
  );

  insertRecipe.run(
    'rec-baghali',
    'baghali-polo-mahiche',
    'باقالی‌پلو با شوید تازه و ماهیچه آرام‌پز',
    'برنج عطری دودی‌شده با باقالی سبز بهاری و ماهیچه نرم زعفرانی',
    'یکی از شاخص‌ترین غذاهای سفره ایرانی؛ با تکنیک پخت آرام ماهیچه در سس پیاز کاراملی و زعفران تا گوشت به‌راحتی از استخوان جدا شود.',
    IMG_BAGHALI,
    'ناهار و شام',
    'تهران',
    'بهار',
    'ناهار',
    JSON.stringify(['سنتی', 'پرپروتئین', 'بدون گلوتن']),
    25,
    150,
    4,
    'متوسط',
    JSON.stringify({calories: 690, protein: 46, carbs: 64, fat: 26, fiber: 6}),
    1,
    40,
    null,
    null,
    'chef-mahsa',
    'published',
    JSON.stringify([
      {name: 'برنج ایرانی', amount: 3, unit: 'پیمانه'},
      {name: 'ماهیچه', amount: 800, unit: 'گرم'},
      {name: 'باقالی', amount: 2, unit: 'پیمانه'},
      {name: 'شوید', amount: 200, unit: 'گرم'},
      {name: 'پیاز', amount: 3, unit: 'عدد'},
      {name: 'سیر', amount: 4, unit: 'حبه'},
      {name: 'زعفران دم‌کرده', amount: 3, unit: 'قاشق غذاخوری'},
      {name: 'کره', amount: 50, unit: 'گرم'},
    ]),
    JSON.stringify([
      {
        order: 1,
        instruction: 'پیازها را خلالی درشت خرد کنید و کف قابلمه بچینید؛ ماهیچه، سیر، چوب دارچین و کمی آب اضافه کنید و با حرارت بسیار ملایم ۲ ساعت آرام‌پز کنید.',
        timerMinutes: 120,
        highlightIngredients: ['ماهیچه', 'پیاز', 'سیر'],
      },
      {
        order: 2,
        instruction: 'باقالی‌ها را ۵ دقیقه پیش از آبکش کردن برنج به آب جوش اضافه کنید تا رنگ سبز زنده بماند.',
        timerMinutes: 8,
        highlightIngredients: ['برنج ایرانی', 'باقالی'],
      },
      {
        order: 3,
        instruction: 'برنج و باقالی را لابه‌لا با شوید تازه خردشده و کره دم بگذارید. نیم ساعت پایانی زعفران دم‌کرده را به ماهیچه بیفزایید و سرو کنید.',
        timerMinutes: 35,
        highlightIngredients: ['شوید', 'کره', 'زعفران دم‌کرده'],
      },
    ]),
    JSON.stringify(['قابلمه چدنی', 'بخارپز']),
    'dish-baghali',
    now
  );

  insertRecipe.run(
    'rec-ash',
    'ash-reshteh-authentic',
    'آش رشته اصیل با نعناداغ زمردی و کشک محلی',
    'هماهنگی سبزی تازه، حبوبات لعاب‌دار و تزیین آرام پیازداغ طلایی',
    'آش رشته‌ای که نه بیش از حد سنگین است و نه آبکی؛ با دستور دقیق زمان افزودن سبزی و رشته برای حفظ رنگ سبز و عطر نعناداغ.',
    IMG_ASH,
    'پیش‌غذا و عصرانه',
    'شیراز',
    'زمستان',
    'عصرانه',
    JSON.stringify(['گیاهی', 'سنتی', 'اقتصادی']),
    20,
    65,
    6,
    'آسان',
    JSON.stringify({calories: 380, protein: 16, carbs: 56, fat: 11, fiber: 9}),
    0,
    0,
    null,
    null,
    'chef-sara',
    'published',
    JSON.stringify([
      {name: 'سبزی آش', amount: 500, unit: 'گرم'},
      {name: 'رشته آش', amount: 250, unit: 'گرم'},
      {name: 'نخود', amount: 0.5, unit: 'پیمانه'},
      {name: 'لوبیا چیتی', amount: 0.5, unit: 'پیمانه'},
      {name: 'عدس', amount: 0.5, unit: 'پیمانه'},
      {name: 'کشک', amount: 1, unit: 'پیمانه'},
      {name: 'پیاز', amount: 2, unit: 'عدد'},
      {name: 'سیر', amount: 4, unit: 'حبه'},
      {name: 'نعنا خشک', amount: 2, unit: 'قاشق غذاخوری'},
    ]),
    JSON.stringify([
      {
        order: 1,
        instruction: 'نخود و لوبیای خیس‌خورده را بپزید؛ در میانه پخت عدس را اضافه کنید تا له نشود.',
        timerMinutes: 30,
        highlightIngredients: ['نخود', 'لوبیا چیتی', 'عدس'],
      },
      {
        order: 2,
        instruction: 'سبزی آش خردشده و نیمی از پیازداغ طلایی را به قابلمه اضافه کنید و اجازه دهید ۱۵ دقیقه آرام بجوشد.',
        timerMinutes: 15,
        highlightIngredients: ['سبزی آش', 'پیاز'],
      },
      {
        order: 3,
        instruction: 'رشته آش را آرام اضافه کنید و به آرامی هم بزنید تا به هم نچسبد؛ پس از ۱۵ دقیقه لعاب‌گیری، با کشک، سیرداغ و نعناداغ سرو کنید.',
        timerMinutes: 15,
        highlightIngredients: ['رشته آش', 'کشک', 'سیر', 'نعنا خشک'],
      },
    ]),
    JSON.stringify(['قابلمه لعابی', 'تابه']),
    'dish-ash',
    now
  );

  // Variation / Fork of Mirza Ghasemi (Vegan version!)
  insertRecipe.run(
    'rec-mirza-vegan',
    'mirza-ghasemi-vegan-version',
    'میرزاقاسمی کاملاً وگان با گردو و سیب‌زمینی تنوری',
    'نسخه گیاهی بدون تخم‌مرغ با بافت غنی‌تر و عطر دودی ملایم',
    'روش پخت جایگزین برای علاقه‌مندان به تغذیه کاملاً وگان که به جای تخم‌مرغ از گردوی ساطوری و روغن زیتون فرابکر استفاده می‌کند.',
    IMG_MIRZA,
    'وگان و گیاهی',
    'گیلان',
    'چهارفصل',
    'شام',
    JSON.stringify(['گیاهی', 'رژیمی', 'سریع', 'بدون گلوتن']),
    10,
    20,
    2,
    'آسان',
    JSON.stringify({calories: 255, protein: 7, carbs: 22, fat: 15, fiber: 8}),
    0,
    0,
    'rec-mirza',
    'حذف تخم‌مرغ و افزودن مغز گردوی ساطوری‌شده برای ایجاد غلظت و پروتئین گیاهی.',
    'chef-sara',
    'published',
    JSON.stringify([
      {name: 'بادمجان', amount: 3, unit: 'عدد'},
      {name: 'گوجه', amount: 3, unit: 'عدد'},
      {name: 'سیر', amount: 4, unit: 'حبه'},
      {name: 'مغز گردو', amount: 40, unit: 'گرم'},
      {name: 'روغن زیتون', amount: 2, unit: 'قاشق غذاخوری'},
    ]),
    JSON.stringify([
      {
        order: 1,
        instruction: 'بادمجان‌ها را کبابی و ساطوری کنید و با سیر و گوجه تفت دهید تا آب اضافی بخار شود.',
        timerMinutes: 15,
        highlightIngredients: ['بادمجان', 'سیر', 'گوجه'],
      },
      {
        order: 2,
        instruction: 'در ۵ دقیقه پایانی، مغز گردوی ساطوری و روغن زیتون تازه را اضافه کنید و گرم سرو کنید.',
        timerMinutes: 5,
        highlightIngredients: ['مغز گردو', 'روغن زیتون'],
      },
    ]),
    JSON.stringify(['تابه چدنی']),
    null,
    now
  );

  // Seed Q&A
  db.prepare(
    'INSERT INTO recipe_questions (id, recipe_id, author_id, author_name, body, solved, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    'q-1',
    'rec-tahchin',
    'chef-sara',
    'سارا فرهادی',
    'اگر بخواهیم ته‌چین را داخل فر درست کنیم، روی ظرف را با فویل بپوشانیم یا بدون پوشش بپزد؟',
    1,
    now
  );

  db.prepare(
    'INSERT INTO recipe_answers (id, question_id, author_id, author_name, author_verified, body, upvotes, is_best, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    'a-1',
    'q-1',
    'chef-mahsa',
    'سرآشپز مهسا رادمنش',
    1,
    'حتماً روی ظرف را با فویل آلومینیومی بپوشانید و چند سوراخ کوچک ایجاد کنید تا رطوبت برنج حفظ شود و کف و دیواره‌ها یکدست طلایی شوند.',
    14,
    1,
    now
  );

  // Seed Editorial Daily Food Ordering Menu
  const insertMenu = db.prepare(`
    INSERT INTO menu_items (
      id, title, subtitle, story, category, image_url, chef_name, chef_verified,
      prep_minutes, calories, single_price, double_price, diet_tags_json, key_ingredients_json, featured, linked_recipe_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertMenu.run(
    'dish-tahchin',
    'ته‌چین زعفرانی مرغ و زرشک دست‌ساز',
    'پخته‌شده با برنج هاشمی گیلان، ماست چکیده محلی و زعفران سرگل قائنات',
    'هر روز صبح در قابلمه‌های چدنی کوچک با پخت آهسته آماده می‌شود تا هنگام تحویل، لایه بیرونی کاملاً ترد و مغز آن نرم و معطر بماند.',
    'منتخب سرآشپز',
    IMG_TAHCHIN,
    'سرآشپز مهسا رادمنش',
    1,
    35,
    560,
    345000,
    640000,
    JSON.stringify(['سنتی', 'پرپروتئین', 'بدون گلوتن']),
    JSON.stringify(['برنج هاشمی', 'سینه مرغ تازه', 'ماست چکیده', 'زعفران قائنات', 'زرشک پلویی', 'خلال پسته']),
    1,
    'rec-tahchin'
  );

  insertMenu.run(
    'dish-fesenjan',
    'خورشت فسنجان ملس با پلوی زعفرانی',
    'تهیه‌شده از گردوی تویسرکان و رب انار خانگی گیلان با ۵ ساعت پخت آرام',
    'بدون روغن اضافه و تنها با روغن‌اندازی طبیعی مغز گردو؛ همراه با برنج دم‌کشیده عطری و دانه‌های انار تازه.',
    'اصیل ایرانی',
    IMG_FESENJAN,
    'سرآشپز کاوه گیلانی',
    1,
    40,
    620,
    390000,
    730000,
    JSON.stringify(['سنتی', 'بدون گلوتن']),
    JSON.stringify(['گردوی تویسرکان', 'رب انار ملس', 'مرغ محلی', 'برنج ایرانی', 'دانه انار']),
    0,
    'rec-fesenjan'
  );

  insertMenu.run(
    'dish-mirza',
    'میرزاقاسمی دودی رشتی با نان سنگک تازه',
    'بادمجان کبابی روی آتش، سیر تازه شمالی و گوجه‌فرنگی محلی',
    'انتخابی سبک، معطر و گیاهی برای ناهار یا شام آرام روزهای کاری؛ سرو شده همراه با نان تازه و زیتون پرورده.',
    'شمالی',
    IMG_MIRZA,
    'سرآشپز کاوه گیلانی',
    1,
    25,
    290,
    245000,
    450000,
    JSON.stringify(['گیاهی', 'رژیمی']),
    JSON.stringify(['بادمجان کبابی', 'گوجه محلی', 'سیر شمالی', 'تخم‌مرغ محلی', 'روغن زیتون']),
    0,
    'rec-mirza'
  );

  insertMenu.run(
    'dish-baghali',
    'باقالی‌پلو با ماهیچه آرام‌پز',
    'ماهیچه گوسفندی تازه پخته‌شده در سس پیاز و زعفران کنار پلوی شوید تازه',
    'به مدت ۴ ساعت در حرارت ملایم پخته می‌شود تا بافتی لطیف و بدون چربی اضافه داشته باشد.',
    'اصیل ایرانی',
    IMG_BAGHALI,
    'سرآشپز مهسا رادمنش',
    1,
    45,
    690,
    580000,
    1090000,
    JSON.stringify(['پرپروتئین', 'سنتی']),
    JSON.stringify(['ماهیچه تازه', 'برنج طارم', 'باقالی سبز', 'شوید تازه', 'زعفران']),
    0,
    'rec-baghali'
  );

  insertMenu.run(
    'dish-ash',
    'آش رشته دست‌ساز عصرانه با کشک محلی',
    'سبزی تازه روز، حبوبات لعاب‌دار، نعناداغ زمردی و پیازداغ طلایی',
    'بسته‌بندی‌شده در ظروف گرم‌نگه‌دار با کشک و نعناداغ جداگانه برای حفظ تازگی تا لحظه سرو.',
    'گیاهی',
    IMG_ASH,
    'سارا فرهادی',
    1,
    20,
    380,
    195000,
    360000,
    JSON.stringify(['گیاهی', 'سنتی']),
    JSON.stringify(['سبزی آش تازه', 'رشته محلی', 'نخود و لوبیا', 'کشک محلی', 'نعناداغ']),
    0,
    'rec-ash'
  );

  // Seed Ecosystem Partners (covering diverse roles out of 10)
  const insertPartner = db.prepare(`
    INSERT INTO partners (
      id, slug, name, role_type, city, neighborhood, description, address, phone, website,
      verified, claim_status, tier, promo_code, promo_label, affiliate_code,
      related_ingredients_json, related_tools_json, catalog_json, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPartner.run(
    'prt-zaferan',
    'khorasan-saffron-house',
    'خانه زعفران خراسان',
    'food_brands',
    'تهران',
    'ونک',
    'تامین مستقیم زعفران سرگل قائنات، زرشک پفکی و ادویه‌های دست‌چین بدون واسطه از کشاورزان خراسان.',
    'تهران، میدان ونک، خیابان ملاصدرا، پلاک ۴۲',
    '۰۲۱-۸۸۶۵۱۲۳۴',
    'https://lagheli.ir/partners/saffron',
    1,
    'verified',
    'sponsor',
    'LAGHELI15',
    '۱۵٪ تخفیف ویژه کاربران لاقلی',
    'AFF-ZAF-01',
    JSON.stringify(['زعفران', 'زعفران دم‌کرده', 'زرشک', 'هل']),
    JSON.stringify(['زعفران‌ساب']),
    JSON.stringify([
      {id: 'c1', title: 'زعفران سرگل ممتاز قائنات (۱ مثقال)', price: 460000, discountPercent: 15, affiliateCode: 'AFF-ZAF-01'},
      {id: 'c2', title: 'زرشک پفکی تازه دست‌چین (۲۵۰ گرم)', price: 185000, discountPercent: 10, affiliateCode: 'AFF-ZAF-02'},
    ]),
    'approved',
    now
  );

  insertPartner.run(
    'prt-castiron',
    'rast-castiron-studio',
    'کارگاه ظروف چدنی رَست',
    'kitchen_equipment',
    'تهران',
    'اندرزگو',
    'طراحی و تولید ظروف چدنی لعاب‌دار و تابه‌های سنگین مناسب پخت آهسته ته‌چین، فسنجان و نان خانگی.',
    'تهران، بلوار اندرزگو، گالری خانه رَست',
    '۰۲۱-۲۲۶۸۹۰۱۰',
    'https://lagheli.ir/partners/rast',
    1,
    'verified',
    'featured',
    'RAST120',
    '۱۲۰٬۰۰۰ تومان تخفیف روی قابلمه‌های چدنی',
    'AFF-RST-01',
    JSON.stringify([]),
    JSON.stringify(['قابلمه چدنی', 'تابه چدنی', 'قابلمه لعابی', 'فر']),
    JSON.stringify([
      {id: 'c3', title: 'قابلمه چدنی لعاب‌دار ۲۴ سانتی (رنگ زیتونی)', price: 3850000, discountPercent: 8, affiliateCode: 'AFF-RST-01'},
      {id: 'c4', title: 'تابه چدنی دست‌ساز میرزاقاسمی', price: 1950000, discountPercent: 5, affiliateCode: 'AFF-RST-02'},
    ]),
    'approved',
    now
  );

  insertPartner.run(
    'prt-gilan-artisan',
    'gilan-organic-pantry',
    'خواربار بومی باغستان گیلان',
    'local_artisans',
    'رشت',
    'گلسار',
    'تولید خانگی رب انار ملس ارگانیک، برنج هاشمی درجه‌یک، سیر ترشی هفت‌ساله و زیتون پرورده رودبار.',
    'رشت، بلوار گلسار، خیابان ۱۰۲',
    '۰۱۳-۳۳۱۱۴۴۵۵',
    '',
    1,
    'verified',
    'featured',
    'GILAN10',
    '۱۰٪ تخفیف محصولات ارگانیک شمال',
    'AFF-GIL-01',
    JSON.stringify(['رب انار', 'برنج ایرانی', 'برنج', 'مغز گردو', 'سیر']),
    JSON.stringify([]),
    JSON.stringify([
      {id: 'c5', title: 'رب انار ملس خانگی گیلان (۵۰۰ گرم)', price: 290000, discountPercent: 10, affiliateCode: 'AFF-GIL-01'},
      {id: 'c6', title: 'برنج هاشمی معطر کشت اول (۵ کیلوگرم)', price: 980000, affiliateCode: 'AFF-GIL-02'},
    ]),
    'approved',
    now
  );

  insertPartner.run(
    'prt-express',
    'sabz-fresh-delivery',
    'پیک سبز — تامین و ارسال فوری تازه‌بار',
    'instant_delivery',
    'تهران',
    'سراسر تهران',
    'تامین و ارسال زیر ۴۵ دقیقه سبزیجات تازه پاک‌شده، لبنیات محلی و اقلام لیست خرید شما.',
    'تهران، مرکز توزیع تازه غرب و شمال',
    '۰۲۱-۴۱۰۹۹۰۰۰',
    '',
    1,
    'verified',
    'sponsor',
    'FREESABZ',
    'ارسال رایگان اولین سبد لیست خرید',
    'AFF-EXP-01',
    JSON.stringify(['سبزی آش', 'شوید', 'بادمجان', 'گوجه', 'پیاز', 'ماست چکیده']),
    JSON.stringify([]),
    JSON.stringify([
      {id: 'c7', title: 'سبد سبزی تازه پاک‌شده (آش، قورمه، پلو)', price: 145000, affiliateCode: 'AFF-EXP-01'},
      {id: 'c8', title: 'اشتراک ارسال فوری ماهانه لیست خرید', price: 220000, discountPercent: 20, affiliateCode: 'AFF-EXP-02'},
    ]),
    'approved',
    now
  );

  insertPartner.run(
    'prt-school',
    'ateliere-ashpazi-saffron',
    'آکادمی آشپزی معاصر ایرانی',
    'culinary_schools',
    'تهران',
    'جردن',
    'کارگاه‌های حضوری و آنلاین تکنیک‌های آشپزی اصیل ایرانی، عکاسی غذا و مدیریت آشپزخانه.',
    'تهران، بلوار نلسون ماندلا، کوچه ناهید شرقی',
    '۰۲۱-۲۲۰۵۵۴۱۲',
    '',
    0,
    'unclaimed',
    'free',
    'CLASS15',
    '۱۵٪ تخفیف کارگاه ته‌چین و پلوهای ایرانی',
    'AFF-SCH-01',
    JSON.stringify([]),
    JSON.stringify([]),
    JSON.stringify([
      {id: 'c9', title: 'کارگاه تخصصی پلوها و ته‌چین‌های ایرانی', price: 1650000, discountPercent: 15, affiliateCode: 'AFF-SCH-01'},
    ]),
    'approved',
    now
  );

  insertPartner.run(
    'prt-restaurant',
    'matbakh-narenj',
    'مطبخ ادیتوریال نارنج و ترنج',
    'restaurants_kitchens',
    'شیراز',
    'معالی‌آباد',
    'سرو غذاهای آرام‌پز ایرانی در فضایی مینیمال با تمرکز بر مواد فصلی فارس و گیلان.',
    'شیراز، بلوار معالی‌آباد، نبش کوچه ۵',
    '۰۷۱-۳۶۳۵۲۲۱۰',
    '',
    0,
    'unclaimed',
    'free',
    'NARENJ10',
    '۱۰٪ تخفیف رزرو میز ناهار',
    'AFF-NAR-01',
    JSON.stringify(['کشک', 'سبزی آش']),
    JSON.stringify([]),
    JSON.stringify([
      {id: 'c10', title: 'منوی تست طعم‌های فصل (دونفره)', price: 890000, discountPercent: 10, affiliateCode: 'AFF-NAR-01'},
    ]),
    'approved',
    now
  );

  // Seed a few sample partner events for initial analytics
  const insertEvent = db.prepare(
    'INSERT INTO partner_events (id, partner_id, event_type, created_at) VALUES (?, ?, ?, ?)'
  );
  insertEvent.run('ev-1', 'prt-zaferan', 'impression', now);
  insertEvent.run('ev-2', 'prt-zaferan', 'impression', now);
  insertEvent.run('ev-3', 'prt-zaferan', 'profile_open', now);
  insertEvent.run('ev-4', 'prt-zaferan', 'coupon_copy', now);
  insertEvent.run('ev-5', 'prt-castiron', 'impression', now);
  insertEvent.run('ev-6', 'prt-castiron', 'affiliate_click', now);
  insertEvent.run('ev-7', 'prt-express', 'impression', now);
}

function seedV2Content(): void {
  const now = new Date().toISOString();

  // Seed 2 authentic Iranian recipes WITHOUT photos yet (to demonstrate crowdsourced real dish photography)
  const insertRecipe = db.prepare(`
    INSERT OR IGNORE INTO recipes (
      id, slug, title, subtitle, description, image_url, category, region, season, meal_type,
      diet_tags_json, prep_minutes, cook_minutes, servings, difficulty, nutrition_json,
      is_vip, vip_gem_cost, parent_recipe_id, variation_note, author_id, status,
      ingredients_json, steps_json, tools_json, linked_menu_dish_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertRecipe.run(
    'rec-kuku-sabzi',
    'kuku-sabzi-majlesi',
    'کوکو سبزی مجلسی با گردو و زرشک',
    'عطر سبزی تازه ایرانی با بافت پفکی در ماهیتابه چدنی (در انتظار عکس واقعی شما)',
    'یکی از محبوب‌ترین و اصیل‌ترین غذاهای خانگی ایران که با سبزی ریزخردشده، تخم‌مرغ تازه، گردوی خردشده و زرشک تفت‌خورده در لاقلی آماده می‌شود. اگر این دستور را پختید، اولین عکس واقعی آن را ثبت کنید و ۴۰ جِم هدیه بگیرید.',
    '',
    'ناهار و شام',
    'تهران',
    'بهار',
    'شام',
    JSON.stringify(['سنتی', 'گیاهی', 'سریع', 'اقتصادی']),
    20,
    25,
    4,
    'آسان',
    JSON.stringify({calories: 320, protein: 14, carbs: 16, fat: 22, fiber: 5}),
    0,
    0,
    null,
    null,
    'chef-mahsa',
    'published',
    JSON.stringify([
      {name: 'سبزی کوکو (تره، جعفری، گشنیز، شوید)', amount: 400, unit: 'گرم'},
      {name: 'تخم‌مرغ', amount: 5, unit: 'عدد'},
      {name: 'گردو خردشده', amount: 50, unit: 'گرم'},
      {name: 'زرشک', amount: 2, unit: 'قاشق غذاخوری'},
      {name: 'آرد سفید', amount: 1, unit: 'قاشق غذاخوری'},
      {name: 'زردچوبه', amount: 1, unit: 'قاشق چای‌خوری'},
      {name: 'روغن مایع', amount: 4, unit: 'قاشق غذاخوری'},
    ]),
    JSON.stringify([
      {order: 1, instruction: 'سبزی کوکو را شسته و کاملاً خشک کنید تا هنگام سرخ شدن آب نیندازد، سپس خیلی ریز خرد کنید.'},
      {order: 2, instruction: 'تخم‌مرغ‌ها را با آرد، زردچوبه، نمک و فلفل سیاه خوب هم بزنید تا کف سبک ایجاد شود.'},
      {order: 3, instruction: 'سبزی، گردو و زرشک را اضافه کرده و آرام مخلوط کنید تا مایه‌ای یکدست به‌دست آید.'},
      {order: 4, instruction: 'ماهیتابه چدنی (لاقلی) را با روغن گرم کنید، مایه را پهن کرده و با درِ بسته روی حرارت ملایم بپزید.', timerMinutes: 12},
      {order: 5, instruction: 'کوکو را برش داده و برگردانید تا طرف دیگر نیز برشته و طلایی شود (این بار بدون در).', timerMinutes: 8},
    ]),
    JSON.stringify(['ماهیتابه چدنی', 'کفگیر']),
    null,
    now
  );

  insertRecipe.run(
    'rec-adas-polo',
    'adas-polo-majlesi',
    'عدس‌پلو مجلسی با کشمش، خرما و پیازداغ طلایی',
    'پلوی مقوی و ساده ایرانی با عطر دارچین و زیره (در انتظار اولین عکس کاربران)',
    'ترکیبی متعادل از عدس نیم‌پز، برنج ایرانی قدکشیده، کشمش پلویی و پیازداغ کاراملی. این دستور از آرشیو پایه لاقلی بارگذاری شده و منتظر ثبت تصویر واقعی غذای پخته‌شده توسط کاربران است.',
    '',
    'ناهار و شام',
    'اصفهان',
    'چهارفصل',
    'ناهار',
    JSON.stringify(['سنتی', 'گیاهی', 'اقتصادی']),
    20,
    50,
    4,
    'آسان',
    JSON.stringify({calories: 485, protein: 16, carbs: 74, fat: 13, fiber: 9}),
    0,
    0,
    null,
    null,
    'chef-parisa',
    'published',
    JSON.stringify([
      {name: 'برنج ایرانی', amount: 3, unit: 'پیمانه'},
      {name: 'عدس سبز', amount: 1.5, unit: 'پیمانه'},
      {name: 'پیاز', amount: 2, unit: 'عدد'},
      {name: 'کشمش پلویی', amount: 100, unit: 'گرم'},
      {name: 'خرما بدون هسته', amount: 10, unit: 'عدد'},
      {name: 'دارچین', amount: 1, unit: 'قاشق چای‌خوری'},
      {name: 'کره', amount: 40, unit: 'گرم'},
    ]),
    JSON.stringify([
      {order: 1, instruction: 'عدس را ۲ ساعت خیس کنید و سپس با کمی نمک حدود ۲۰ دقیقه بپزید تا نرم شود ولی له نشود.', timerMinutes: 20},
      {order: 2, instruction: 'پیازها را خلالی کرده و با حرارت ملایم تا طلایی شدن سرخ کنید؛ کشمش و دارچین را در ۲ دقیقه آخر بیفزایید.', timerMinutes: 10},
      {order: 3, instruction: 'برنج آبکش‌شده را لایه‌لایه با عدس و کمی پودر دارچین در قابلمه ریخته و دم بگذارید.', timerMinutes: 35},
      {order: 4, instruction: 'هنگام سرو، عدس‌پلو را با پیازداغ، کشمش و خرمای تفت‌خورده در کره تزیین کنید.'},
    ]),
    JSON.stringify(['قابلمه نچسب', 'ماهیتابه چدنی']),
    null,
    now
  );

  // Give seeded sponsor partners initial commercial wallet balances if 0
  db.prepare('UPDATE partners SET business_balance = 5000000 WHERE id = ? AND business_balance = 0').run('prt-zaferan');
  db.prepare('UPDATE partners SET business_balance = 3200000 WHERE id = ? AND business_balance = 0').run('prt-express');
  db.prepare('UPDATE partners SET business_balance = 1800000 WHERE id = ? AND business_balance = 0').run('prt-castiron');

  // Seed initial sponsor campaigns if empty
  const campCount = (db.prepare('SELECT COUNT(*) as c FROM sponsor_campaigns').get() as {c: number}).c;
  if (campCount === 0) {
    const insertCamp = db.prepare(`
      INSERT INTO sponsor_campaigns (
        id, partner_id, title, subtitle, placement, promo_code, cta_label,
        budget_toman, spent_toman, impressions, clicks, status, starts_at, ends_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCamp.run(
      'camp-zaferan-autumn',
      'prt-zaferan',
      'برداشت تازه زعفران سرگل قائنات — ۱۵٪ ویژه کاربران لاقلی',
      'مستقیم از کشاورز با برگه آزمایش خلوص برای ته‌چین‌ها و پلوهای اصیل ایرانی.',
      'explore_showcase',
      'LAGHELI15',
      'مشاهده فروشگاه زعفران',
      2500000,
      420000,
      1420,
      98,
      'active',
      '۱۴۰۵/۰۸/۰۱',
      '۱۴۰۵/۰۹/۳۰',
      now
    );
    insertCamp.run(
      'camp-sabz-delivery',
      'prt-express',
      'ارسال رایگان اولین سبد لیست خرید در زیر ۴۵ دقیقه',
      'سبزی تازه پاک‌شده، لبنیات محلی و مواد اولیه دستور پخت شما درب منزل.',
      'shopping_delivery',
      'FREESABZ',
      'تکمیل سبد با پیک سبز',
      1800000,
      310000,
      960,
      74,
      'active',
      '۱۴۰۵/۰۸/۱۰',
      '۱۴۰۵/۱۰/۱۵',
      now
    );
  }

  // Seed 1 sample pending user photo so Admin Photo Moderation queue is testable immediately
  const photoCount = (db.prepare('SELECT COUNT(*) as c FROM recipe_photos').get() as {c: number}).c;
  if (photoCount === 0) {
    db.prepare(`
      INSERT INTO recipe_photos (id, recipe_id, user_id, user_name, image_url, caption, status, is_cover, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'photo-seed-1',
      'rec-fesenjan',
      'chef-parisa',
      'سرآشپز پریسا بهرامی',
      '/src/assets/images/dish_fesenjan_editorial_1795554313427.jpg',
      'با گردوی تازه تویسرکان و ۴ ساعت جاافتادن آرام؛ روغن‌انداختن بی‌نظیری داشت.',
      'pending',
      0,
      now
    );
  }
}
