// Supabase Edge Function: embed.
// Takes { text } and returns { embedding }, 384 numbers from the built-in gte-small model.
//
// Only our server may call it: `auth: 'secret'` accepts nothing but the project's default secret
// key on the apikey header, so nobody else can spend its compute. verify_jwt is off for this
// function in config.toml, because secret keys are not JWTs.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from 'npm:@supabase/server@1.9.2';
import { handleEmbed } from './handler.ts';

const model = new Supabase.ai.Session('gte-small');

const embedFunction = {
  fetch: withSupabase({ auth: 'secret' }, (req) =>
    handleEmbed(req, async (text) => {
      const output = await model.run(text, { mean_pool: true, normalize: true });
      return Array.from(output as ArrayLike<number>);
    }),
  ),
};

export default embedFunction;
