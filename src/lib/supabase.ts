import { createClient } from '@supabase/supabase-js'

// URL y llave publicable: son públicas por diseño. Las tablas no son accesibles con ellas (RLS sin políticas);
// todo pasa por funciones RPC que validan tokens en la base de datos.
export const SUPABASE_URL = 'https://evfvcvllsjlakrpqmvdj.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_eULSc0LoT39KdFjD1eJiyQ_hQV5MotS'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
