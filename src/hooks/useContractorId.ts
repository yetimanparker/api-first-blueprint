import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useContractorId() {
  const [contractorId, setContractorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContractorId() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: contractor } = await supabase
          .from('contractors')
          .select('id')
          .eq('user_id', user.id)
          .single();

        setContractorId(contractor?.id || null);
      } catch (error) {
        console.error('Error fetching contractor ID:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchContractorId();
  }, []);

  return { contractorId, loading };
}