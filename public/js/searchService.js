// ════════════════════════════════════════════════════════════
// AURA – Search Service  |  js/searchService.js
// Handles Recent Searches in localStorage and Suggestion logic
// ════════════════════════════════════════════════════════════

import { getAllCachedProducts } from './productService.js';

const RECENT_SEARCHES_KEY = 'aura_recent_searches';
const MAX_RECENT = 5;

// ── RECENT SEARCHES (LocalStorage) ─────────────────────────

export function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY)) || [];
  } catch (e) {
    return [];
  }
}

export function addRecentSearch(query) {
  if (!query || !query.trim()) return;
  const q = query.trim();

  let searches = getRecentSearches();
  
  // Remove if exists to push it to the top
  searches = searches.filter(s => s.toLowerCase() !== q.toLowerCase());
  
  // Add to top
  searches.unshift(q);
  
  // Cap to MAX_RECENT
  if (searches.length > MAX_RECENT) {
    searches = searches.slice(0, MAX_RECENT);
  }

  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  return searches;
}

export function removeRecentSearch(query) {
  let searches = getRecentSearches();
  searches = searches.filter(s => s.toLowerCase() !== query.toLowerCase());
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  return searches;
}

export function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
  return [];
}

// ── SEARCH SUGGESTIONS ──────────────────────────────────────

/**
 * Returns top N matching products for a live dropdown suggestion.
 * Utilizes the cached product list to avoid excessive Firestore reads.
 */
export async function getSearchSuggestions(query, limit = 4) {
  if (!query || !query.trim()) return [];
  
  const q = query.toLowerCase().trim();
  const allProducts = await getAllCachedProducts();

  // Simple scoring for suggestions:
  // Match in name = high score
  // Match in brand/category = medium score
  
  const matches = [];

  for (const p of allProducts) {
    let score = 0;
    const name = (p.name || '').toLowerCase();
    const brand = (p.brand || '').toLowerCase();
    const cat = (p.categoryName || '').toLowerCase();
    const tags = p.tags || [];

    if (name === q) score += 100; // exact match
    else if (name.startsWith(q)) score += 50; // prefix match
    else if (name.includes(q)) score += 20; // substring match

    if (brand.includes(q)) score += 10;
    if (cat.includes(q)) score += 10;
    if (tags.some(t => t.toLowerCase().includes(q))) score += 5;

    if (score > 0) {
      matches.push({ product: p, score });
    }
  }

  // Sort by score (desc), then rating (desc)
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.product.ratingAvg || 0) - (a.product.ratingAvg || 0);
  });

  // Return top N
  return matches.slice(0, limit).map(m => m.product);
}
