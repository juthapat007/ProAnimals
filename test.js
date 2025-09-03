import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const EventSourcePkg = require('eventsource'); // จะได้ object
const EventSource = EventSourcePkg.EventSource || EventSourcePkg; // fallback

const url = 'https://ab.reasonlabsapi.com/sub/sdk-QtSYWOMLlkHBbNMB';

const es = new EventSource(url);

es.onopen = () => console.log(new Date(), 'Connection opened');
es.onmessage = (event) => console.log(new Date(), 'Message:', event.data);
es.onerror = (err) => console.error(new Date(), 'Error:', err);

