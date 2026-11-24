import {formatQuantity, toFaDigits} from '../shared/persianEngine.ts';
import type {Recipe} from '../shared/types.ts';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'error';

export interface ShareRecipeOptions {
  servings?: number;
  includeIngredients?: boolean;
}

export function buildRecipeSharePayload(recipe: Recipe, options: ShareRecipeOptions = {}) {
  const targetServings = options.servings || recipe.servings || 4;
  const scale = targetServings / Math.max(1, recipe.servings || 4);
  const totalMinutes = (recipe.prepMinutes || 0) + (recipe.cookMinutes || 0);
  const url = `${window.location.origin}/?recipe=${encodeURIComponent(recipe.slug || recipe.id)}`;

  const lines: string[] = [
    `${recipe.title} — لاقلی`,
    `${recipe.category} · ${recipe.region} · زمان کل: ${toFaDigits(totalMinutes)} دقیقه (برای ${toFaDigits(targetServings)} نفر)`,
  ];

  if (options.includeIngredients && recipe.ingredients?.length) {
    lines.push('');
    lines.push('مواد اولیه:');
    const preview = recipe.ingredients.slice(0, 12);
    for (const ing of preview) {
      lines.push(`• ${ing.name}: ${formatQuantity(ing.amount * scale)} ${ing.unit}`);
    }
    if (recipe.ingredients.length > preview.length) {
      lines.push(`و ${toFaDigits(recipe.ingredients.length - preview.length)} مورد دیگر در لاقلی...`);
    }
  } else if (recipe.description) {
    lines.push('');
    lines.push(recipe.description);
  }

  return {
    title: `${recipe.title} | لاقلی`,
    text: lines.join('\n'),
    url,
  };
}

export async function shareRecipeWithWebShare(
  recipe: Recipe,
  options: ShareRecipeOptions = {}
): Promise<{outcome: ShareOutcome; message: string}> {
  const payload = buildRecipeSharePayload(recipe, options);

  // 1. Primary path: Native Web Share API (Mobile & supported Desktop browsers)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const shareData: ShareData = {
        title: payload.title,
        text: payload.text,
        url: payload.url,
      };
      if (typeof navigator.canShare !== 'function' || navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return {outcome: 'shared', message: 'دستور پخت با موفقیت به اشتراک گذاشته شد.'};
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return {outcome: 'cancelled', message: ''};
      }
      // Fall through to clipboard fallback if Web Share is blocked (e.g. iframe policy)
    }
  }

  // 2. Fallback path: Copy formatted recipe text & deep link to clipboard
  const clipboardText = `${payload.text}\n\n${payload.url}`;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(clipboardText);
      return {outcome: 'copied', message: 'لینک و جزئیات دستور پخت در حافظه کپی شد.'};
    }
  } catch {
    // Fall through to legacy textarea copy
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = clipboardText;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return {outcome: 'copied', message: 'لینک و جزئیات دستور پخت کپی شد.'};
  } catch {
    return {outcome: 'error', message: 'امکان اشتراک‌گذاری در این مرورگر فراهم نیست.'};
  }
}
