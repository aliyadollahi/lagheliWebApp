export type UserRole = 'user' | 'chef' | 'partner' | 'admin';

export type PartnerRoleId =
  | 'food_brands'
  | 'kitchen_equipment'
  | 'stores_supermarkets'
  | 'restaurants_kitchens'
  | 'cafes_bakeries'
  | 'chefs_nutritionists'
  | 'culinary_schools'
  | 'local_artisans'
  | 'catering_events'
  | 'instant_delivery';

export type ShoppingCategory =
  | 'سبزیجات و صیفی‌جات'
  | 'میوه و دانه‌ها'
  | 'لبنیات'
  | 'پروتئین و تخم‌مرغ'
  | 'ادویه و معطرها'
  | 'چاشنی و رب‌ها'
  | 'غلات و آرد'
  | 'حبوبات'
  | 'خشکبار و مغزها'
  | 'روغن و چربی‌ها'
  | 'سایر مواد';

export interface IngredientItem {
  name: string;
  amount: number;
  unit: string;
  category?: ShoppingCategory;
  optional?: boolean;
}

export interface RecipeStep {
  order: number;
  instruction: string;
  timerMinutes?: number;
  highlightIngredients?: string[];
}

export interface NutritionInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface ChefSummary {
  id: string;
  name: string;
  city: string;
  bio: string;
  specialty: string;
  isVerifiedChef: boolean;
  followersCount: number;
  followingCount: number;
  recipesCount: number;
  xp: number;
  levelName: string;
  isFollowing?: boolean;
}

export interface Recipe {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  category: string;
  region: string;
  season: string;
  mealType: string;
  dietTags: string[];
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  difficulty: 'آسان' | 'متوسط' | 'حرفه‌ای';
  nutrition: NutritionInfo;
  isVip: boolean;
  vipGemCost: number;
  isUnlocked?: boolean;
  parentRecipeId?: string | null;
  variationNote?: string | null;
  authorId: string;
  authorName: string;
  authorVerified: boolean;
  status: 'published' | 'pending';
  ingredients: IngredientItem[];
  steps: RecipeStep[];
  tools: string[];
  createdAt: string;
  isBookmarked?: boolean;
  linkedMenuDishId?: string | null;
}

export interface SubstitutionSuggestion {
  substitute: string;
  ratio: string;
  flavorNote: string;
  compatibility: number;
  category: ShoppingCategory;
  isVegan: boolean;
  source: 'native' | 'offline';
}

export interface ShoppingItem {
  id: string;
  name: string;
  canonicalName: string;
  amount: number;
  unit: string;
  category: ShoppingCategory;
  recipeId?: string | null;
  recipeTitle?: string | null;
  checked: boolean;
  createdAt: string;
}

export interface EditorialMenuItem {
  id: string;
  title: string;
  subtitle: string;
  story: string;
  category: string;
  imageUrl: string;
  chefName: string;
  chefVerified: boolean;
  prepMinutes: number;
  calories: number;
  singlePrice: number;
  doublePrice: number;
  dietTags: string[];
  keyIngredients: string[];
  featured: boolean;
  linkedRecipeId?: string | null;
}

export interface OrderRecord {
  id: string;
  trackingCode: string;
  city: string;
  neighborhood: string;
  address: string;
  phone: string;
  deliverySlot: string;
  note?: string;
  items: {
    dishId: string;
    title: string;
    portion: 'single' | 'double';
    quantity: number;
    unitPrice: number;
  }[];
  subtotal: number;
  packagingFee: number;
  deliveryFee: number;
  total: number;
  status: 'confirmed' | 'preparing' | 'delivering' | 'delivered';
  createdAt: string;
}

export interface RecipeAnswer {
  id: string;
  questionId: string;
  authorId: string;
  authorName: string;
  authorVerified: boolean;
  body: string;
  upvotes: number;
  isBest: boolean;
  createdAt: string;
}

export interface RecipeQuestion {
  id: string;
  recipeId: string;
  recipeTitle?: string;
  authorId: string;
  authorName: string;
  body: string;
  solved: boolean;
  createdAt: string;
  answers: RecipeAnswer[];
}

export interface PartnerCatalogItem {
  id: string;
  title: string;
  price: number;
  discountPercent?: number;
  affiliateCode?: string;
}

export interface Partner {
  id: string;
  slug: string;
  name: string;
  roleType: PartnerRoleId;
  city: string;
  neighborhood: string;
  description: string;
  address: string;
  phone: string;
  website?: string;
  verified: boolean;
  claimStatus: 'unclaimed' | 'pending' | 'verified';
  tier: 'free' | 'featured' | 'sponsor';
  promoCode?: string;
  promoLabel?: string;
  affiliateCode?: string;
  relatedIngredients: string[];
  relatedTools: string[];
  catalog: PartnerCatalogItem[];
  status: 'approved' | 'pending';
  followersCount: number;
  isFollowing?: boolean;
  createdAt: string;
}

export interface EcosystemConfig {
  marketplaceTabEnabled: boolean;
  marketplaceTitle: string;
  exploreShowcaseEnabled: boolean;
  recipeContextEnabled: boolean;
  shoppingDeliveryCardEnabled: boolean;
  maxPartnerCardsPerRecipe: number;
  enabledPartnerRoles: PartnerRoleId[];
  activeCampaignTitle: string;
}

export interface UserProfile {
  id: string;
  phone: string;
  name: string;
  city: string;
  neighborhood: string;
  bio: string;
  specialty: string;
  isVerifiedChef: boolean;
  chefVerificationStatus: 'none' | 'pending' | 'approved';
  role: UserRole;
  xp: number;
  levelName: string;
  nextLevelXp: number;
  gems: number;
  followersCount: number;
  followingCount: number;
}

export interface BadgeItem {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  gemReward: number;
  progress: number;
  target: number;
  unlocked: boolean;
}

export interface GemTransaction {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export interface UserCoupon {
  id: string;
  title: string;
  code: string;
  partnerName: string;
  discountLabel: string;
  used: boolean;
  createdAt: string;
}

export interface GemStoreOffer {
  id: string;
  title: string;
  partnerName: string;
  discountLabel: string;
  gemCost: number;
  codePrefix: string;
}

export interface PartnerAnalyticsSummary {
  totalImpressions: number;
  totalProfileOpens: number;
  totalCouponCopies: number;
  totalGemRedeems: number;
  totalAffiliateClicks: number;
  byPartner: {
    partnerId: string;
    partnerName: string;
    impressions: number;
    profileOpens: number;
    couponCopies: number;
    affiliateClicks: number;
  }[];
}
