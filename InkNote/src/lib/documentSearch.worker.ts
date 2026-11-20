import { collectDocumentMatches } from "./documentSearch";

self.onmessage = (event: MessageEvent<Parameters<typeof collectDocumentMatches>>) => {
  self.postMessage(collectDocumentMatches(...event.data));
};
