import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const sourceContractorId = '196be53c-184a-4e02-ad6c-501b56288961'; // test3@empoweroffgrid.com
    
    const imagesToCopy = [
      { source: `${sourceContractorId}/1760906216494.jpeg`, dest: 'defaults/sod.jpg' },
      { source: `${sourceContractorId}/1760880119023.jpg`, dest: 'defaults/topsoil.jpg' },
      { source: `${sourceContractorId}/1760906057850.jpg`, dest: 'defaults/fence.jpg' },
      { source: `${sourceContractorId}/1760882438934.jpg`, dest: 'defaults/tree.jpg' },
    ];

    const results = [];

    for (const image of imagesToCopy) {
      console.log(`Copying ${image.source} to ${image.dest}`);
      
      // Download the source image
      const { data: sourceData, error: downloadError } = await supabaseAdmin.storage
        .from('product-photos')
        .download(image.source);

      if (downloadError) {
        console.error(`Error downloading ${image.source}:`, downloadError);
        results.push({ image: image.dest, success: false, error: downloadError.message });
        continue;
      }

      // Upload to destination
      const { error: uploadError } = await supabaseAdmin.storage
        .from('product-photos')
        .upload(image.dest, sourceData, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) {
        console.error(`Error uploading ${image.dest}:`, uploadError);
        results.push({ image: image.dest, success: false, error: uploadError.message });
      } else {
        console.log(`Successfully copied to ${image.dest}`);
        results.push({ image: image.dest, success: true });
      }
    }

    const allSuccessful = results.every(r => r.success);

    return new Response(
      JSON.stringify({
        success: allSuccessful,
        message: allSuccessful 
          ? 'All default product images copied successfully' 
          : 'Some images failed to copy',
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: allSuccessful ? 200 : 207
      }
    );

  } catch (error) {
    console.error('Error in copy-default-product-images:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
