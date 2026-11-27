<template>
  <button
    type="button"
    class="fav-btn"
    :class="{ active: isFavorite(toolId) }"
    :aria-label="isFavorite(toolId) ? `取消收藏 ${toolName}` : `收藏 ${toolName}`"
    :aria-pressed="isFavorite(toolId)"
    :title="isFavorite(toolId) ? '取消收藏' : '收藏到首页'"
    @click.stop="toggleFavorite(toolId)"
  >{{ isFavorite(toolId) ? '★' : '☆' }}</button>
</template>

<script setup>
import { useToolPrefs } from '../composables/useToolPrefs'

defineProps({
  toolId: { type: String, required: true },
  toolName: { type: String, default: '' }
})
const { isFavorite, toggleFavorite } = useToolPrefs()
</script>

<style scoped>
.fav-btn {
  border: none;
  background: transparent;
  color: var(--text-3);
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
  padding: .2rem .3rem;
  border-radius: 6px;
}
.fav-btn:hover { color: var(--favorite-star); background: var(--warn-soft); }
.fav-btn.active { color: var(--favorite-star); }
</style>
