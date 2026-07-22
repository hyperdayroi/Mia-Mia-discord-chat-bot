import { PERSONA_KEY } from "../config/env.js";
import mia from "./mia.js";
import mie from "./mie.js";

const PERSONAS = { mia, mie };

const persona = PERSONAS[PERSONA_KEY];
if (!persona) {
  console.error(`Không tìm thấy persona cho PERSONA="${PERSONA_KEY}"`);
  process.exit(1);
}

export default persona;
