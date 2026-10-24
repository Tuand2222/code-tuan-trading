import { readTables } from '../data/tableReader';
self.onmessage = (event: MessageEvent<{ bytes: ArrayBuffer; name: string }>) => {
  try {
    self.postMessage({ tables: readTables(event.data.bytes, event.data.name) });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
