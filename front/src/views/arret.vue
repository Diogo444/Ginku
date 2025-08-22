<script setup>
import Loader from '@/components/loader.vue'
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import Buttonback from '@/components/buttonback.vue'
import api from '@/api'

defineOptions({ name: 'ArretPage' })
const route = useRoute()

const lignes = ref({})
const variantesMap = ref({}) // { [idLigne]: { [sensAller]: { [destNorm]: idVariante } } }

// --- helpers ---
const normalize = (s = '') =>
  s
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprime accents
    .replace(/\s+/g, ' ') // espaces multiples -> simple espace
    .trim()
    .toLowerCase()

onMounted(async () => {
  try {
    const response = await api.get(`/getTempsLieu/${route.params.nom}`)
    if (!response.data) return
    lignes.value = response.data

    // Récup variantes desservant l'arrêt pour rendre le badge cliquable
    const idArrets = [
      ...new Set(
        (lignes.value.listeTemps || [])
          .map((t) => t.idArret)
          .filter((id) => !!id)
      ),
    ]
    if (!idArrets.length) return

    const map = {}
    await Promise.all(
      idArrets.map(async (idArret) => {
        try {
          const variantes = await api.get(
            `/getVariantesDesservantArret/${idArret}`
          )
          if (!variantes.data) return

          for (const ligne of variantes.data) {
            if (!map[ligne.id]) map[ligne.id] = {}
            for (const variante of ligne.variantes) {
              const fullDest = variante.precisionDestination
                ? `${variante.destination} ${variante.precisionDestination}`
                : variante.destination
              const destNorm = normalize(fullDest)
              if (!map[ligne.id][variante.sensAller])
                map[ligne.id][variante.sensAller] = {}
              map[ligne.id][variante.sensAller][destNorm] = variante.id
            }
          }
        } catch (err) {
          console.error(err)
        }
      })
    )
    variantesMap.value = map
  } catch (e) {
    console.error(e)
  }
})

// Regroupement par numéro de ligne, puis par destination
const lignesRegroupees = computed(() => {
  const src = lignes.value?.listeTemps || []
  const lignesMap = {}

  for (const t of src) {
    const key = t.numLignePublic
    if (!lignesMap[key]) {
      lignesMap[key] = {
        numLignePublic: t.numLignePublic,
        couleurFond: t.couleurFond,
        couleurTexte: t.couleurTexte,
        idLigne: t.idLigne,
        destinations: {},
        sensAllerSet: new Set(), // on garde les sens rencontrés pour le fallback
      }
    }

    const group = lignesMap[key]
    group.sensAllerSet.add(t.sensAller)

    const destRaw = t.precisionDestination
      ? `${t.destination} ${t.precisionDestination}`
      : t.destination

    if (!group.destinations[destRaw]) {
      group.destinations[destRaw] = {
        horaires: [],
        sensAller: t.sensAller,
        destNorm: normalize(destRaw),
      }
    }
    group.destinations[destRaw].horaires.push(t)
  }

  // Convertit en tableaux et résout les idVariante + fallback pour le badge
  return Object.values(lignesMap).map((ligne) => {
    const dests = Object.entries(ligne.destinations).map(([destination, data]) => {
      const idVar = variantesMap.value?.[ligne.idLigne]?.[data.sensAller]?.[data.destNorm] || null
      return { destination, horaires: data.horaires, idVariante: idVar, sensAller: data.sensAller }
    })

    // idVariante à utiliser pour le badge (clic sur le numéro de ligne)
    const firstWithVar = dests.find((d) => d.idVariante)?.idVariante
    let linkVarianteId = firstWithVar || null

    // Fallback supplémentaire : si rien de trouvé, tente un des sens présents via variantesMap
    if (!linkVarianteId) {
      for (const sens of ligne.sensAllerSet) {
        const bySens = variantesMap.value?.[ligne.idLigne]?.[sens]
        if (bySens) {
          const anyId = Object.values(bySens)[0]
          if (anyId) {
            linkVarianteId = anyId
            break
          }
        }
      }
    }

    return {
      ...ligne,
      destinations: dests,
      linkVarianteId, // utilisé pour rendre le badge cliquable une seule fois
    }
  })
})
</script>

<template>
  <div
    class="min-h-screen bg-light-bg text-light-text dark:bg-dark-bg dark:text-dark-text p-4 sm:p-6 lg:p-8 w-screen relative"
  >
    <Buttonback />

    <div class="max-w-2xl mx-auto">
      <h1
        class="pt-20 text-2xl sm:text-3xl font-bold text-light-primary dark:text-dark-primary mb-6 text-center sm:pt-0"
      >
        Horaires - {{ route.params.nom }}
      </h1>

      <!-- Affichage des horaires -->
      <div v-if="lignes?.listeTemps?.length" class="space-y-6">
        <div
          v-for="ligne in lignesRegroupees"
          :key="ligne.numLignePublic"
          class="bg-white dark:bg-dark-secondary p-4 rounded-lg shadow-md"
        >
          <!-- HEADER DE LIGNE : badge affiché UNE SEULE FOIS -->
          <div class="mb-3 flex items-center gap-3">
            <router-link
              v-if="ligne.linkVarianteId"
              :to="{
                name: 'ArretFromLigneView',
                params: {
                  idLigne: ligne.idLigne,
                  idVariante: ligne.linkVarianteId,
                  numLigne: ligne.numLignePublic,
                },
              }"
            >
              <span
                class="inline-block px-3 py-1 rounded-full font-bold text-sm"
                :style="{
                  backgroundColor: '#' + ligne.couleurFond,
                  color: '#' + ligne.couleurTexte,
                }"
              >
                {{ ligne.numLignePublic }}
              </span>
            </router-link>

            <span
              v-else
              class="inline-block px-3 py-1 rounded-full font-bold text-sm opacity-60"
              :style="{
                backgroundColor: '#' + ligne.couleurFond,
                color: '#' + ligne.couleurTexte,
              }"
              title="Variante introuvable pour cet arrêt"
            >
              {{ ligne.numLignePublic }}
            </span>
          </div>

          <!-- LISTE DES DESTINATIONS (sans répéter le badge) -->
          <div v-for="dest in ligne.destinations" :key="dest.destination" class="mb-3">
            <h2 class="font-bold text-lg mb-3">
              <span class="font-bold text-base text-light-text dark:text-dark-text">
                {{ dest.destination }}
              </span>
            </h2>
            <ul class="flex justify-between px-10">
              <li v-for="(horaire, index) in dest.horaires" :key="index">
                <router-link
                  v-if="horaire.numVehicule"
                  :to="{ name: 'InfosTransportPage', params: { id: horaire.numVehicule } }"
                >
                  <span class="font-semibold text-light-primary dark:text-dark-text">
                    {{ horaire.temps }}
                  </span>
                </router-link>
                <span v-else class="font-semibold text-light-primary dark:text-dark-text">
                  {{ horaire.temps }}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div
        v-else-if="lignes && lignes.listeTemps && lignes.listeTemps.length === 0"
        class="text-center py-8"
      >
        <p class="text-light-text dark:text-dark-text text-lg">
          Aucun horaire disponible pour cet arrêt
        </p>
      </div>

      <Loader v-else />
    </div>
  </div>
</template>
