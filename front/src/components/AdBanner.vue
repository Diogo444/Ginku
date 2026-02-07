<script setup>
import { ref, onMounted, nextTick } from 'vue'

defineOptions({ name: 'AdBanner' })

defineProps({
  adSlot: { type: String, required: true },
  adFormat: { type: String, default: 'auto' },
  fullWidthResponsive: { type: Boolean, default: true },
})

const adContainer = ref(null)

onMounted(async () => {
  await nextTick()
  try {
    ;(window.adsbygoogle = window.adsbygoogle || []).push({})
  } catch {
    // AdSense peut échouer silencieusement (bloqueur de pubs, etc.)
  }
})
</script>

<template>
  <aside
    ref="adContainer"
    class="my-4 sm:my-5 rounded-xl sm:rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 bg-surface-light dark:bg-surface-dark shadow-soft"
    aria-label="Publicité"
    role="complementary"
  >
    <div class="flex items-center gap-1.5 px-3 pt-2 pb-1">
      <span class="material-icons-round text-xs text-gray-400 dark:text-gray-500" aria-hidden="true">info</span>
      <span class="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium select-none">Annonce</span>
    </div>
    <div class="px-2 pb-2">
      <ins
        class="adsbygoogle"
        style="display: block"
        data-ad-client="ca-pub-6031484816129735"
        :data-ad-slot="adSlot"
        :data-ad-format="adFormat"
        :data-full-width-responsive="fullWidthResponsive ? 'true' : 'false'"
      />
    </div>
  </aside>
</template>
