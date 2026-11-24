/**
 * Editorial Skeleton Screens — Lagheli Design System
 * Zero-CLS, high-contrast monochrome placeholders matching exact magazine proportions.
 */

export function RecipeFeedSkeleton({includeHero = true}: {includeHero?: boolean}) {
  return (
    <div aria-busy="true" aria-label="در حال بارگذاری دستورهای پخت" className="space-y-12 sm:space-y-16">
      {includeHero && (
        <div className="space-y-6 pb-12 border-b border-[#E6E6E3] dark:border-[#242422]">
          {/* Masthead Strip Skeleton */}
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-[#E6E6E3]/70 dark:border-[#242422]">
            <div className="h-3.5 w-48 rounded-full editorial-skeleton" />
            <div className="h-3.5 w-36 rounded-full editorial-skeleton hidden sm:block" />
          </div>

          {/* 12-Col Editorial Cover Spread Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-7 aspect-[16/10] lg:min-h-[380px] rounded-3xl editorial-skeleton" />
            <div className="lg:col-span-5 flex flex-col justify-between gap-8 py-1">
              <div className="space-y-5">
                <div className="h-3.5 w-44 rounded-full editorial-skeleton" />
                <div className="space-y-2.5">
                  <div className="h-9 w-11/12 rounded-xl editorial-skeleton" />
                  <div className="h-9 w-7/12 rounded-xl editorial-skeleton" />
                </div>
                <div className="space-y-2 pt-1">
                  <div className="h-4 w-full rounded-lg editorial-skeleton" />
                  <div className="h-4 w-10/12 rounded-lg editorial-skeleton" />
                  <div className="h-4 w-6/12 rounded-lg editorial-skeleton" />
                </div>
                {/* 3-Column Tabular Metrics Strip */}
                <div className="grid grid-cols-3 gap-4 py-4 border-y border-[#E6E6E3]/80 dark:border-[#242422]">
                  {[0, 1, 2].map((idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="h-2.5 w-14 rounded-full editorial-skeleton" />
                      <div className="h-4 w-20 rounded-md editorial-skeleton" />
                    </div>
                  ))}
                </div>
                <div className="h-4 w-32 rounded-full editorial-skeleton" />
              </div>

              <div className="flex items-center gap-3">
                <div className="h-[50px] w-48 rounded-full editorial-skeleton" />
                <div className="h-[50px] w-36 rounded-full editorial-skeleton" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3-Column Magazine Recipe Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
        {Array.from({length: 6}).map((_, i) => (
          <div key={i} className="flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="aspect-[4/3] rounded-2xl editorial-skeleton" />
              <div className="flex items-center justify-between gap-4">
                <div className="h-3 w-32 rounded-full editorial-skeleton" />
                <div className="h-3 w-16 rounded-full editorial-skeleton" />
              </div>
              <div className="space-y-2">
                <div className="h-5 w-4/5 rounded-lg editorial-skeleton" />
                <div className="h-3.5 w-full rounded-md editorial-skeleton" />
                <div className="h-3.5 w-3/4 rounded-md editorial-skeleton" />
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-[#E6E6E3]/70 dark:border-[#242422]">
              <div className="h-3.5 w-28 rounded-full editorial-skeleton" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg editorial-skeleton" />
                <div className="w-8 h-8 rounded-lg editorial-skeleton" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecipeDetailSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="در حال بارگذاری جزئیات دستور پخت"
      className="px-5 sm:px-10 lg:px-14 pt-6 sm:pt-10 pb-14 sm:pb-20 space-y-12"
    >
      {/* Hero + Overlapping Glass Panel Skeleton */}
      <div className="relative">
        <div className="aspect-[16/10] sm:aspect-[16/9] rounded-[26px] editorial-skeleton" />
        <div className="relative z-10 -mt-10 sm:-mt-16 mx-2 sm:mx-6 lg:mx-8 rounded-[28px] bg-[#FFFFFF]/80 dark:bg-[#151514]/80 backdrop-blur-[12px] border border-[rgba(255,255,255,0.1)] p-6 sm:p-9 lg:p-10 space-y-6">
          <div className="h-3.5 w-48 rounded-full editorial-skeleton" />
          <div className="space-y-2.5">
            <div className="h-9 w-3/4 rounded-xl editorial-skeleton" />
            <div className="h-4 w-full max-w-xl rounded-lg editorial-skeleton" />
            <div className="h-4 w-5/6 max-w-lg rounded-lg editorial-skeleton" />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div className="h-12 w-44 rounded-full editorial-skeleton" />
            <div className="h-12 w-36 rounded-full editorial-skeleton" />
          </div>
        </div>
      </div>

      {/* 5-Column Nutrition Strip Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 py-5 border-y border-[#E6E6E3] dark:border-[#242422]">
        {Array.from({length: 5}).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-16 rounded-full editorial-skeleton" />
            <div className="h-5 w-20 rounded-md editorial-skeleton" />
          </div>
        ))}
      </div>

      {/* 2-Column Editorial Ingredients + Steps Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-4">
          <div className="h-6 w-36 rounded-lg editorial-skeleton" />
          {Array.from({length: 6}).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-[#E6E6E3]/60 dark:border-[#242422]">
              <div className="h-4 w-36 rounded-md editorial-skeleton" />
              <div className="h-4 w-16 rounded-md editorial-skeleton" />
            </div>
          ))}
        </div>
        <div className="lg:col-span-7 space-y-7">
          <div className="h-6 w-40 rounded-lg editorial-skeleton" />
          {Array.from({length: 4}).map((_, i) => (
            <div key={i} className="space-y-2.5">
              <div className="h-3.5 w-16 rounded-full editorial-skeleton" />
              <div className="h-4 w-full rounded-md editorial-skeleton" />
              <div className="h-4 w-11/12 rounded-md editorial-skeleton" />
              <div className="h-4 w-2/3 rounded-md editorial-skeleton" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FridgeMatchesSkeleton() {
  return (
    <div aria-busy="true" aria-label="در حال بررسی دستورهای قابل پخت" className="space-y-4">
      {Array.from({length: 3}).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#151514] p-4 sm:p-5 flex flex-col sm:flex-row gap-5"
        >
          <div className="sm:w-44 shrink-0 aspect-[4/3] rounded-xl editorial-skeleton" />
          <div className="flex-1 flex flex-col justify-between gap-4">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-24 rounded-full editorial-skeleton" />
                <div className="h-3.5 w-16 rounded-full editorial-skeleton" />
              </div>
              <div className="h-5 w-2/3 rounded-lg editorial-skeleton" />
              <div className="h-3.5 w-11/12 rounded-md editorial-skeleton" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-28 rounded-full editorial-skeleton" />
              <div className="h-10 w-40 rounded-full editorial-skeleton" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OrderMenuSkeleton() {
  return (
    <div aria-busy="true" aria-label="در حال بارگذاری منوی روز" className="space-y-10">
      {/* Featured Dish Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-stretch border-b border-[#E6E6E3] dark:border-[#242422] pb-10">
        <div className="lg:col-span-7 aspect-[16/10] rounded-2xl editorial-skeleton" />
        <div className="lg:col-span-5 flex flex-col justify-between gap-6 py-1">
          <div className="space-y-3.5">
            <div className="h-3.5 w-48 rounded-full editorial-skeleton" />
            <div className="h-8 w-5/6 rounded-xl editorial-skeleton" />
            <div className="h-4 w-full rounded-md editorial-skeleton" />
            <div className="h-4 w-4/5 rounded-md editorial-skeleton" />
          </div>
          <div className="space-y-4">
            <div className="h-7 w-32 rounded-lg editorial-skeleton" />
            <div className="flex gap-3">
              <div className="h-12 w-48 rounded-full editorial-skeleton" />
              <div className="h-12 w-32 rounded-full editorial-skeleton" />
            </div>
          </div>
        </div>
      </div>

      {/* Single-column Editorial Food Rows Skeleton */}
      <div className="max-w-4xl space-y-8">
        {Array.from({length: 3}).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-1 sm:grid-cols-12 gap-5 sm:gap-8 pb-8 border-b border-[#E6E6E3]/80 dark:border-[#242422] items-center"
          >
            <div className="sm:col-span-5 aspect-[4/3] rounded-2xl editorial-skeleton" />
            <div className="sm:col-span-7 space-y-3">
              <div className="h-3.5 w-44 rounded-full editorial-skeleton" />
              <div className="h-6 w-3/4 rounded-lg editorial-skeleton" />
              <div className="h-4 w-full rounded-md editorial-skeleton" />
              <div className="flex items-center justify-between pt-2">
                <div className="h-5 w-28 rounded-md editorial-skeleton" />
                <div className="h-11 w-24 rounded-full editorial-skeleton" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketplaceSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="در حال بارگذاری دایرکتوری اصناف"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {Array.from({length: 6}).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#151514] p-6 flex flex-col justify-between gap-5"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 rounded-full editorial-skeleton" />
              <div className="h-3 w-20 rounded-full editorial-skeleton" />
            </div>
            <div className="h-6 w-3/4 rounded-lg editorial-skeleton" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-full rounded-md editorial-skeleton" />
              <div className="h-3.5 w-11/12 rounded-md editorial-skeleton" />
              <div className="h-3.5 w-2/3 rounded-md editorial-skeleton" />
            </div>
          </div>
          <div className="pt-3 border-t border-[#E6E6E3]/70 dark:border-[#242422] flex items-center justify-between">
            <div className="h-3.5 w-32 rounded-full editorial-skeleton" />
            <div className="h-3.5 w-20 rounded-full editorial-skeleton" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminWorkspaceSkeleton() {
  return (
    <div aria-busy="true" aria-label="در حال بارگذاری پنل مدیریت" className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({length: 4}).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-3"
          >
            <div className="h-3 w-24 rounded-full editorial-skeleton" />
            <div className="h-7 w-20 rounded-lg editorial-skeleton" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
        {Array.from({length: 5}).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-2 border-b last:border-b-0 border-[#E6E6E3]/60 dark:border-[#242422]">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-12 h-12 rounded-xl editorial-skeleton shrink-0" />
              <div className="space-y-2 flex-1 max-w-md">
                <div className="h-4 w-2/3 rounded-md editorial-skeleton" />
                <div className="h-3 w-1/2 rounded-md editorial-skeleton" />
              </div>
            </div>
            <div className="h-9 w-24 rounded-full editorial-skeleton shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
