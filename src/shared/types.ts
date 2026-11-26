export type SystemAdminRole = 'senior_admin' | 'editor' | 'marketing_manager' | 'finance_manager';
export type AdminRole = SystemAdminRole | (string & {});

export type UserRole =
  | 'user'
  | 'chef'
  | 'partner'
  | 'editor'
  | 'marketing_manager'
  | 'finance_manager'
  | 'senior_admin'
  | 'admin'
  | (string & {});

export type AdminPermission =
  | 'dashboard.view'
  | 'content.recipes'
  | 'content.photos'
  | 'content.qa'
  | 'content.kitchen'
  | 'content.menu'
  | 'content.chefs'
  | 'ads.manage'
  | 'app.layout'
  | 'finance.wallets'
  | 'finance.pricing'
  | 'finance.partners'
  | 'finance.campaigns'
  | 'finance.orders'
  | 'users.view'
  | 'users.manage'
  | 'rbac.manage'
  | 'ecosystem.manage';

export interface DynamicRoleDefinition {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  permissions: AdminPermission[];
  isSystem: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type NativeAdFormat =
  | 'inline_ingredient'
  | 'contextual_tool'
  | 'feed_editorial_story'
  | 'pantry_companion';

export type NativeAdMediaType = 'text' | 'click' | 'banner';

export interface NativeAdUnit {
  id: string;
  partnerId: string;
  partnerName: string;
  format: NativeAdFormat;
  mediaType?: NativeAdMediaType;
  title: string;
  subtitle: string;
  editorialCopy: string;
  ctaLabel: string;
  targetUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  recipeCategories?: string[];
  matchKeywords: string[];
  matchCategories: string[];
  slotId?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  pricingMode?: 'fixed' | 'auction' | 'sponsorship';
  bidAmountToman?: number;
  priority: number;
  status: 'active' | 'paused';
  impressions: number;
  clicks: number;
  createdAt: string;
}

export type AdSlotPricingModel = 'fixed' | 'auction' | 'hybrid';

export interface AdSlotInventory {
  id: string;
  title: string;
  description: string;
  format: NativeAdFormat;
  mediaType: NativeAdMediaType;
  targetCategory: string;
  pricingModel: AdSlotPricingModel;
  fixedPriceToman: number;
  minBidToman: number;
  bidStepToman: number;
  isExclusive: boolean;
  status: 'open' | 'paused';
  activePartnerName?: string | null;
  activeStartsAt?: string | null;
  activeEndsAt?: string | null;
  highestPendingBidToman?: number;
  pendingBidsCount?: number;
  createdAt: string;
}

export type AdBidStatus = 'pending' | 'approved' | 'rejected' | 'outbid';

export interface AdBidOrBooking {
  id: string;
  slotId: string;
  slotTitle: string;
  slotTargetCategory: string;
  slotFormat: NativeAdFormat;
  slotMediaType: NativeAdMediaType;
  advertiserId: string;
  partnerId: string;
  partnerName: string;
  bookingType: 'fixed' | 'auction';
  bidAmountToman: number;
  startsAt: string;
  endsAt: string;
  title: string;
  subtitle: string;
  editorialCopy: string;
  ctaLabel: string;
  targetUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  recipeCategories: string[];
  matchKeywords: string[];
  status: AdBidStatus;
  adminNote: string;
  createdAdId?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

export type FlagshipPackageDuration = '1m' | '3m' | '6m' | '12m';

export interface FlagshipSponsorship {
  id: string;
  partnerId: string;
  partnerName: string;
  tagline: string;
  ctaLabel: string;
  targetUrl?: string;
  utmCampaign?: string;
  duration: FlagshipPackageDuration;
  priceToman: number;
  startsAt: string;
  endsAt: string;
  status: 'active' | 'scheduled' | 'paused' | 'ended';
  impressions: number;
  clicks: number;
  createdAt: string;
}

export type LocalVenueType = 'restaurant' | 'cafe' | 'fastfood';

export interface LocalVenueSuggestion {
  id: string;
  partnerId?: string | null;
  name: string;
  venueType: LocalVenueType;
  city: string;
  neighborhood: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  servedDishes: string[];
  servedCategories: string[];
  deliveryNote: string;
  menuUrl?: string;
  utmCampaign?: string;
  isFeatured: boolean;
  status: 'active' | 'paused';
  impressions: number;
  clicks: number;
  createdAt: string;
}

export interface LocalVenueMatchResult {
  venue: LocalVenueSuggestion;
  matchScore: number;
  distanceKm: number | null;
  matchedDishLabel: string;
  matchReason: string;
}

export interface AdvertiserAccount {
  id: string;
  partnerId: string;
  partnerName: string;
  loginIdentifier: string;
  managerName: string;
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface AdvertiserDashboardPayload {
  account: AdvertiserAccount;
  partner: Partner | null;
  summary: {
    totalImpressions: number;
    totalClicks: number;
    ctrPercent: number;
    activeAdsCount: number;
    pendingBidsCount: number;
    approvedSpendToman: number;
  };
  ads: NativeAdUnit[];
  bids: AdBidOrBooking[];
  slots: AdSlotInventory[];
  venues: LocalVenueSuggestion[];
  sponsorships: FlagshipSponsorship[];
}

export interface LiveAuctionBidEntry {
  id: string;
  rank: number;
  bidderLabel: string;
  isOwn: boolean;
  bidAmountToman: number;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  title?: string;
  editorialCopy?: string;
  targetUrl?: string;
  utmCampaign?: string;
  gapFromLeaderToman: number;
}

export interface LiveAuctionSlotState {
  slot: AdSlotInventory;
  currentHighestBidToman: number;
  nextMinimumBidToman: number;
  totalActiveBids: number;
  uniqueBiddersCount: number;
  competitionLevel: 'calm' | 'active' | 'heated';
  priceSpreadPercent: number;
  myHighestBidToman: number | null;
  myRank: number | null;
  myStatus: 'leading' | 'outbid' | 'watching';
  gapToLeadToman: number;
  estimatedWinProbability: number;
  roundEndsAt: string;
  myLastCreative?: {
    title: string;
    subtitle: string;
    editorialCopy: string;
    ctaLabel: string;
    targetUrl: string;
    utmCampaign: string;
    startsAt: string;
    endsAt: string;
    keywords: string[];
  } | null;
  leaderboard: LiveAuctionBidEntry[];
}

export interface LiveAuctionEvent {
  id: string;
  slotId: string;
  slotTitle: string;
  bidderLabel: string;
  isOwn: boolean;
  bidAmountToman: number;
  createdAt: string;
}

export interface AdvertiserLiveAuctionPayload {
  serverTime: string;
  partnerId: string;
  partnerName: string;
  summary: {
    activeAuctionSlotsCount: number;
    leadingSlotsCount: number;
    outbidSlotsCount: number;
    watchingSlotsCount: number;
    myTotalActiveBidCommitmentToman: number;
  };
  auctions: LiveAuctionSlotState[];
  recentEvents: LiveAuctionEvent[];
}

export type DietaryTagId =
  | 'vegan'
  | 'vegetarian'
  | 'dairy_free'
  | 'gluten_free'
  | 'low_carb'
  | 'nut_free'
  | 'no_processed_meat'
  | 'no_red_meat'
  | 'no_sugar';

export interface UserDietaryPreferences {
  diets: DietaryTagId[];
  excludedIngredients: string[];
  preferredMealTimes: string[];
  cookingFrequency: 'daily' | 'weekly' | 'occasional' | 'rarely';
  strictAdFiltering: boolean;
  updatedAt?: string;
}

export type BehavioralEventType =
  | 'session_start'
  | 'session_heartbeat'
  | 'tab_view'
  | 'recipe_view'
  | 'recipe_cook_start'
  | 'recipe_cook_complete'
  | 'scroll_depth'
  | 'section_skip'
  | 'ad_impression'
  | 'ad_click'
  | 'ad_diet_blocked'
  | 'partner_view'
  | 'venue_view'
  | 'chef_view'
  | 'fridge_search'
  | 'shopping_add';

export interface BehavioralTelemetryEventInput {
  eventType: BehavioralEventType;
  sectionName?: string;
  targetType?: 'recipe' | 'partner' | 'venue' | 'chef' | 'ad' | 'tab' | 'section';
  targetId?: string;
  targetLabel?: string;
  category?: string;
  numericValue?: number;
  metadata?: Record<string, string | number | boolean>;
  createdAt?: string;
}

export interface BehavioralSessionMetaInput {
  sessionId: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  osFamily: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'other';
  displayMode: 'pwa' | 'browser';
  themeMode: 'light' | 'dark';
  viewportWidth: number;
  durationSeconds: number;
  pagesViewed: number;
}

export interface ApprovedExecutiveInsightReport {
  id: string;
  title: string;
  audienceScope: 'brands' | 'institutions' | 'special_auctions';
  approvedBy: string;
  publishedToAuctions: boolean;
  createdAt: string;
  summary: {
    totalSessionsAnalyzed: number;
    mobileSharePercent: number;
    peakHourRange: string;
    avgDwellSeconds: number;
    longestSessionMinutes: number;
    scroll75ReachPercent: number;
    topCategories: {label: string; sharePercent: number}[];
    dietaryRestrictionSharePercent: number;
    bestAttentionSlot: string;
    recommendedAdFormat: string;
  };
}

export interface ExecutiveBehavioralReportPayload {
  generatedAt: string;
  overview: {
    totalTrackedSessions: number;
    uniqueSubjectsCount: number;
    totalEventsRecorded: number;
    avgSessionDurationSeconds: number;
    longestSessionSeconds: number;
    returningRatePercent: number;
    dietSafeBlockedAdsCount: number;
  };
  devices: {
    byType: {key: string; label: string; count: number; percent: number}[];
    byOs: {key: string; label: string; count: number; percent: number}[];
    pwaSharePercent: number;
    darkThemeSharePercent: number;
  };
  temporal: {
    hourlyHeatmap: {hour: number; label: string; visits: number; avgDwellSeconds: number}[];
    peakWindowLabel: string;
    weekdayVsWeekend: {weekdayPercent: number; weekendPercent: number};
  };
  attentionPhysics: {
    scrollFunnel: {depth: number; label: string; sessionsCount: number; reachPercent: number}[];
    sectionZones: {
      sectionKey: string;
      sectionLabel: string;
      views: number;
      avgDwellSeconds: number;
      fastSkipPercent: number;
      interactionRatePercent: number;
      attentionVerdict: 'high_attention' | 'moderate' | 'fast_skip';
      recommendedAdPlacement: string;
    }[];
  };
  passiveAffinities: {
    topRecipes: {id: string; label: string; category: string; passiveViews: number; avgDwellSeconds: number; cookStarts: number}[];
    topBrands: {id: string; label: string; passiveViews: number; clicks: number}[];
    topVenues: {id: string; label: string; category: string; passiveViews: number}[];
    topChefs: {id: string; label: string; passiveViews: number}[];
  };
  dietarySafety: {
    strictExclusionEnabledSubjects: number;
    dietBreakdown: {dietId: DietaryTagId; label: string; count: number; percent: number}[];
    hardBlockedIncompatibleViews: number;
    topExcludedKeywords: {keyword: string; count: number}[];
  };
  loyaltyAndSubscriptionRadar: {
    averageLoyaltyScore: number;
    activeCookingRatioPercent: number;
    communityParticipationPercent: number;
    subscriptionReadinessPercent: number;
    addressableLoyalUsersCount: number;
    personas: {
      id: string;
      label: string;
      description: string;
      usersCount: number;
      sharePercent: number;
      subscriptionFit: 'high' | 'medium' | 'low';
    }[];
    futureValueSignals: {
      featureLabel: string;
      demandScorePercent: number;
      rationale: string;
    }[];
    nextPhaseNote: string;
  };
  approvedReports: ApprovedExecutiveInsightReport[];
}

export interface DynamicAppSectionsConfig {
  heroEnabled: boolean;
  heroTitle: string;
  heroSubtitle: string;
  editorialNotice: string;
  searchBarEnabled: boolean;
  quickCategoriesEnabled: boolean;
  kitchenTabEnabled: boolean;
  shoppingTabEnabled: boolean;
  submitRecipeEnabled: boolean;
  featuredCategories: string[];
}

export interface AdHarmonyConfig {
  adsEnabled: boolean;
  feedEditorialBannerEnabled: boolean;
  feedBannerEveryNRecipes: number;
  inlineIngredientMentionEnabled: boolean;
  maxInlineMentionsPerRecipe: number;
  toolAndSubMentionEnabled: boolean;
  fridgeCompanionAdEnabled: boolean;
  shoppingCompanionAdEnabled: boolean;
  nearbyVenuesEnabled?: boolean;
  flagshipSponsorEnabled?: boolean;
  disclosureLabel: string;
}

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

export type CostEconomyTier = 'اقتصادی' | 'متوسط' | 'مجلسی';

export interface RecipeEstimatedCost {
  totalToman: number;
  perServingToman: number;
  tier: CostEconomyTier;
  level: 1 | 2 | 3;
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
  photoCreditName?: string | null;
  communityPhotosCount?: number;
  estimatedCost?: RecipeEstimatedCost;
  latestVersionNumber?: number;
  pendingDraftsCount?: number;
}

export interface RecipePhoto {
  id: string;
  recipeId: string;
  recipeTitle?: string;
  recipeHasCover?: boolean;
  userId: string;
  userName: string;
  imageUrl: string;
  caption: string;
  status: 'pending' | 'approved' | 'rejected';
  isCover: boolean;
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  accountType: 'user' | 'partner';
  accountId: string;
  accountName: string;
  currency: 'toman' | 'gem';
  amount: number;
  balanceAfter: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export type CampaignPlacement =
  | 'explore_showcase'
  | 'recipe_context'
  | 'shopping_delivery'
  | 'marketplace_banner';

export interface SponsorCampaign {
  id: string;
  partnerId: string;
  partnerName: string;
  title: string;
  subtitle: string;
  placement: CampaignPlacement;
  promoCode?: string;
  ctaLabel: string;
  budgetToman: number;
  spentToman: number;
  impressions: number;
  clicks: number;
  status: 'active' | 'paused' | 'ended';
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
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
  businessBalance: number;
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
  appSections: DynamicAppSectionsConfig;
  adHarmony: AdHarmonyConfig;
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
  walletBalance: number;
  isSuspended?: boolean;
  followersCount: number;
  followingCount: number;
}

export interface AdminUserRow {
  id: string;
  phone: string;
  name: string;
  city: string;
  neighborhood: string;
  specialty: string;
  role: UserRole;
  isVerifiedChef: boolean;
  chefVerificationStatus: 'none' | 'pending' | 'approved';
  xp: number;
  gems: number;
  walletBalance: number;
  isSuspended: boolean;
  recipesCount: number;
  photosCount: number;
  createdAt: string;
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

export interface AdminDashboardStats {
  totalRecipes: number;
  recipesWithoutPhoto: number;
  pendingRecipesCount: number;
  pendingDraftVersionsCount: number;
  pendingPhotosCount: number;
  approvedPhotosCount: number;
  totalUsers: number;
  verifiedChefsCount: number;
  totalPartners: number;
  pendingPartnersCount: number;
  activeCampaignsCount: number;
  totalOrdersCount: number;
  totalUserWalletToman: number;
  totalPartnerWalletToman: number;
}

export interface DeliveryPricingConfig {
  freeDeliveryThreshold: number;
  packagingFee: number;
  standardDeliveryFee: number;
}

export interface CustomSubstitutionRule {
  id: string;
  ingredient: string;
  substitute: string;
  ratio: string;
  compatibility: number;
  flavorNote: string;
  isVegan: boolean;
}

export interface KitchenConfig {
  quickFridgeItems: string[];
  quickSubQueries: string[];
  customSubstitutions: CustomSubstitutionRule[];
}

export interface AdminQuestionRow {
  id: string;
  recipeId: string;
  recipeTitle: string;
  authorName: string;
  body: string;
  solved: boolean;
  createdAt: string;
  answers: {
    id: string;
    authorName: string;
    body: string;
    upvotes: number;
    isBest: boolean;
    createdAt: string;
  }[];
}

export interface RbacAuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: AdminRole;
  targetUserId: string;
  targetUserName: string;
  previousRole: UserRole;
  newRole: UserRole;
  note: string;
  createdAt: string;
}

export type RecipeVersionStatus = 'draft' | 'published' | 'archived' | 'rejected';

export interface RecipeVersionSnapshot {
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
  ingredients: IngredientItem[];
  steps: RecipeStep[];
  tools: string[];
}

export interface RecipeVersion {
  id: string;
  recipeId: string;
  versionNumber: number;
  status: RecipeVersionStatus;
  changeSummary: string;
  snapshot: RecipeVersionSnapshot;
  createdById: string;
  createdByName: string;
  reviewedById?: string | null;
  reviewedByName?: string | null;
  reviewNote: string;
  createdAt: string;
  reviewedAt?: string | null;
}

export interface PendingRecipeDraftItem {
  versionId: string;
  recipeId: string;
  recipeTitle: string;
  recipeStatus: 'published' | 'pending';
  versionNumber: number;
  changeSummary: string;
  createdByName: string;
  createdAt: string;
  snapshot: RecipeVersionSnapshot;
}

export type EditorialPriorityLevel = 'critical' | 'high' | 'medium';

export type EditorialReasonCode =
  | 'missing_cover_photo'
  | 'unsolved_questions'
  | 'pending_draft_review'
  | 'pending_community_photo'
  | 'thin_steps_or_timers'
  | 'missing_tools_or_tags'
  | 'pending_publication';

export type EditorialRecommendedAction =
  | 'edit_draft'
  | 'review_draft'
  | 'moderate_photo'
  | 'answer_qa';

export interface SearchTrendItem {
  query: string;
  normalizedQuery: string;
  searchCount: number;
  recentCount: number;
  avgResultsCount: number;
  matchedRecipesCount: number;
  category: ShoppingCategory;
  source: 'search' | 'fridge' | 'mixed';
  lastSearchedAt: string;
}

export interface EditorialAttentionReason {
  code: EditorialReasonCode;
  label: string;
  detail: string;
  weight: number;
}

export interface EditorialRecipeRecommendation {
  recipe: Recipe;
  priorityScore: number;
  priorityLevel: EditorialPriorityLevel;
  demandScore: number;
  attentionScore: number;
  searchHits: number;
  bookmarksCount: number;
  questionsCount: number;
  unsolvedQuestionsCount: number;
  pendingPhotosCount: number;
  pendingDraftsCount: number;
  matchedTrends: {query: string; count: number}[];
  reasons: EditorialAttentionReason[];
  recommendedAction: EditorialRecommendedAction;
  recommendedActionLabel: string;
  costTier: CostEconomyTier;
}

export interface AdminEditorialInsightsReport {
  generatedAt: string;
  totalSearchesAnalyzed: number;
  uniqueTrendingQueries: number;
  catalogHealthScore: number;
  trendingQueries: SearchTrendItem[];
  contentGaps: SearchTrendItem[];
  recommendations: EditorialRecipeRecommendation[];
}




