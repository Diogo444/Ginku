# Ginku

## Déploiement avec Docker

1. Définir la clé API utilisée par le backend :
   
   ```env
   APIKEY=\<votre cle api\>
   ```
   
   Exportez cette variable ou placez-la dans un fichier `.env` au même niveau que `docker-compose.yml`.

2. Construire et lancer l'application :

   ```sh
   docker compose up --build
   ```

   Le service Caddy expose le projet sur le port `80` et redirige :

   - `/api/*` vers le service backend
   - `/` vers le service frontend
"# Ginku" 
