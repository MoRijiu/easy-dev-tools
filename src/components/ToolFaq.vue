<script setup>
defineProps({
  faqs: {
    type: Array,
    required: true,
    // 每个 faq 应包含 { question, answer }
  }
});
</script>

<template>
  <div class="faq">
    <h2>常见问题</h2>
    <details v-for="(faq, index) in faqs" :key="index">
      <summary>{{ faq.question }}</summary>
      <p>{{ faq.answer }}</p>
    </details>
  </div>
</template>

<style scoped>
.faq {
  margin-top: 40px;
}

.faq h2 {
  font-size: 1.8rem;
  color: var(--text-strong);
  margin-bottom: 20px;
}

.faq details {
  margin-bottom: 15px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 15px;
  background: var(--surface);
}

.faq summary {
  font-weight: 600;
  color: var(--text-strong);
  cursor: pointer;
  user-select: none;
}

.faq summary:hover {
  color: var(--accent);
}

.faq p {
  margin-top: 10px;
  color: var(--text-2);
  line-height: 1.8;
}
</style>

