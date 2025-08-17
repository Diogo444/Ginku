import axios from 'axios';

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL
});

const cache = new Map();
const TTL = 60 * 1000; // 60 seconds

async function get(url, config = {}) {
  const key = url + JSON.stringify(config.params || {});
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < TTL) {
    return cached.response;
  }
  const response = await instance.get(url, config);
  cache.set(key, { response, timestamp: Date.now() });
  return response;
}

export default { get };
