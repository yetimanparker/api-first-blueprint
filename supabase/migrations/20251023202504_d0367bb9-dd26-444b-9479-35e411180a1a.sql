-- Update product images for bob@poolelandscapesupply.com to use default images
UPDATE products
SET photo_url = 'https://aiwwquousyzdkagporcy.supabase.co/storage/v1/object/public/product-photos/defaults/sod.jpg'
WHERE id = 'fe0b8455-c9f5-4e59-8257-4e647c7f44a7';

UPDATE products
SET photo_url = 'https://aiwwquousyzdkagporcy.supabase.co/storage/v1/object/public/product-photos/defaults/topsoil.jpg'
WHERE id = 'ad7ad7c5-3182-4cf2-8268-6ac0b5634735';

UPDATE products
SET photo_url = 'https://aiwwquousyzdkagporcy.supabase.co/storage/v1/object/public/product-photos/defaults/fence.jpg'
WHERE id = '6b42980e-cc75-4a74-abdf-f200dfe9453c';

UPDATE products
SET photo_url = 'https://aiwwquousyzdkagporcy.supabase.co/storage/v1/object/public/product-photos/defaults/tree.jpg'
WHERE id = '373b9f7f-520b-40e3-af6b-b3ca47d1d449';