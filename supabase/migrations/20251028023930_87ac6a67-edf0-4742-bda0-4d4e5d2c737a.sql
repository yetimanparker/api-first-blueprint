-- Add sold in increments columns to products table
ALTER TABLE products 
ADD COLUMN sold_in_increments_of numeric NULL,
ADD COLUMN increment_unit_label text NULL,
ADD COLUMN increment_description text NULL,
ADD COLUMN allow_partial_increments boolean DEFAULT false;