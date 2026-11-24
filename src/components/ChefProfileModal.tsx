import {useEffect, useState} from 'react';
import {BadgeCheck, MapPin, X} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {toFaDigits} from '../shared/persianEngine.ts';
import type {ChefSummary, Recipe, UserProfile} from '../shared/types.ts';
import {EditorialImage} from './EditorialImage.tsx';

interface ChefProfileModalProps {
  chefId: string;
  currentUser: UserProfile | null;
  onClose: () => void;
  onSelectChef: (id: string) => void;
  onOpenRecipe: (recipe: Recipe) => void;
  onRequireAuth: () => void;
  onNotify: (msg: string) => void;
}

export function ChefProfileModal({
  chefId,
  currentUser,
  onClose,
  onSelectChef,
  onOpenRecipe,
  onRequireAuth,
  onNotify,
}: ChefProfileModalProps) {
  const [tab, setTab] = useState<'recipes' | 'followers' | 'following'>('recipes');
  const [chef, setChef] = useState<ChefSummary | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [followers, setFollowers] = useState<ChefSummary[]>([]);
  const [following, setFollowing] = useState<ChefSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChef = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{
        chef: ChefSummary;
        recipes: Recipe[];
        followers: ChefSummary[];
        following: ChefSummary[];
      }>(`/api/chefs/${chefId}`);
      setChef(res.chef);
      setRecipes(res.recipes);
      setFollowers(res.followers);
      setFollowing(res.following);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChef();
    setTab('recipes');
  }, [chefId]);

  const handleToggleFollow = async () => {
    if (!chef) return;
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    try {
      const res = await apiRequest<{following: boolean}>(`/api/chefs/${chef.id}/follow`, {method: 'POST'});
      onNotify(res.following ? `${chef.name} دنبال شد.` : `دنبال کردن ${chef.name} لغو شد.`);
      loadChef();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[#F6F6F5] dark:bg-[#0B0B0B] border border-[#E6E6E3] dark:border-[#282825] p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          {chef ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{chef.name}</h2>
                {chef.isVerifiedChef && <BadgeCheck className="w-5 h-5 text-[#B54B1F] dark:text-[#E29A6F]" />}
              </div>
              <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E] flex items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {chef.city}
                </span>
                <span>·</span>
                <span>{chef.specialty}</span>
                <span>·</span>
                <span>{chef.levelName}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-[#5C5C58]">در حال بارگذاری...</div>
          )}
          <button
            type="button"
            aria-label="بستن"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#EFEFED] dark:hover:bg-[#20201E]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!loading && chef && (
          <>
            {chef.bio && <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">{chef.bio}</p>}

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#E6E6E3] dark:border-[#282825]">
              <div className="flex items-center gap-5 text-xs tabular-nums">
                <span>
                  <strong className="text-sm">{toFaDigits(chef.recipesCount)}</strong> دستور
                </span>
                <span>
                  <strong className="text-sm">{toFaDigits(chef.followersCount)}</strong> دنبال‌کننده
                </span>
                <span>
                  <strong className="text-sm">{toFaDigits(chef.followingCount)}</strong> دنبال‌شونده
                </span>
              </div>

              {currentUser?.id !== chef.id && (
                <button
                  type="button"
                  onClick={handleToggleFollow}
                  className={`min-h-[44px] px-5 rounded-xl text-sm font-medium transition-colors ${
                    chef.isFollowing
                      ? 'border border-[#B54B1F] text-[#B54B1F] dark:border-[#E29A6F] dark:text-[#E29A6F]'
                      : 'bg-[#B54B1F] text-[#FAFAFA] dark:bg-[#E29A6F] dark:text-[#0B0B0B]'
                  }`}
                >
                  {chef.isFollowing ? 'لغو دنبال کردن' : 'دنبال کردن'}
                </button>
              )}
            </div>

            {/* 3 Public Chef Tabs */}
            <div className="inline-flex p-1 rounded-xl bg-[#EFEFED] dark:bg-[#20201E]">
              {[
                {id: 'recipes', label: `دستورها (${toFaDigits(recipes.length)})`},
                {id: 'followers', label: `دنبال‌کنندگان (${toFaDigits(followers.length)})`},
                {id: 'following', label: `دنبال‌شوندگان (${toFaDigits(following.length)})`},
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id as 'recipes' | 'followers' | 'following')}
                  className={`min-h-[40px] px-4 rounded-lg text-xs font-medium transition-colors ${
                    tab === t.id
                      ? 'bg-[#FFFFFF] dark:bg-[#151514] text-[#0D0D0D] dark:text-[#FAFAFA]'
                      : 'text-[#5C5C58] dark:text-[#A3A39E]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'recipes' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {recipes.map((rec) => (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenRecipe(rec);
                    }}
                    className="text-right rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] overflow-hidden"
                  >
                    <EditorialImage src={rec.imageUrl} alt={rec.title} aspectClass="aspect-[4/3]" />
                    <div className="p-3.5 space-y-1">
                      <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                        {rec.category} · {toFaDigits(rec.prepMinutes + rec.cookMinutes)} دقیقه
                      </div>
                      <div className="text-sm font-bold line-clamp-1">{rec.title}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {(tab === 'followers' || tab === 'following') && (
              <div className="divide-y divide-[#E6E6E3]/70 dark:divide-[#282825] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514]">
                {(tab === 'followers' ? followers : following).length === 0 ? (
                  <p className="p-6 text-center text-xs text-[#5C5C58]">هنوز کاربری در این فهرست وجود ندارد.</p>
                ) : (
                  (tab === 'followers' ? followers : following).map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => onSelectChef(person.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-right hover:bg-[#F6F6F5] dark:hover:bg-[#20201E]"
                    >
                      <div>
                        <div className="text-sm font-semibold flex items-center gap-1.5">
                          <span>{person.name}</span>
                          {person.isVerifiedChef && (
                            <BadgeCheck className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
                          )}
                        </div>
                        <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                          {person.city} · {person.specialty}
                        </div>
                      </div>
                      <span className="text-xs text-[#B54B1F] dark:text-[#E29A6F]">مشاهده</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
