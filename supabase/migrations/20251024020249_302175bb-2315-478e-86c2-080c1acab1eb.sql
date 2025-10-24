-- Add all 12 categories and subcategories to Bob's account
-- Bob's contractor_id: 3135d50a-43dc-49f5-978e-4a130f1fed6f

-- First, delete existing categories and subcategories for Bob's account
-- (Subcategories will cascade delete)
DELETE FROM product_categories WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f';

-- ========================================
-- CREATE CATEGORIES FOR BOB
-- ========================================

-- 1. Landscaping
INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
VALUES ('3135d50a-43dc-49f5-978e-4a130f1fed6f', 'Landscaping', '#228B22', 0, true);

-- 2. Hardscaping
INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
VALUES ('3135d50a-43dc-49f5-978e-4a130f1fed6f', 'Hardscaping', '#8B4513', 1, true);

-- 3. Concrete
INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
VALUES ('3135d50a-43dc-49f5-978e-4a130f1fed6f', 'Concrete', '#808080', 2, true);

-- 4. Fencing
INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
VALUES ('3135d50a-43dc-49f5-978e-4a130f1fed6f', 'Fencing', '#D2691E', 3, true);

-- 5. Tree Services
INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
VALUES ('3135d50a-43dc-49f5-978e-4a130f1fed6f', 'Tree Services', '#2D5016', 4, true);

-- 6. Lawn Care & Maintenance
INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
VALUES ('3135d50a-43dc-49f5-978e-4a130f1fed6f', 'Lawn Care & Maintenance', '#32CD32', 5, true);

-- 7. Irrigation
INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
VALUES ('3135d50a-43dc-49f5-978e-4a130f1fed6f', 'Irrigation', '#4169E1', 6, true);

-- 8. Drainage Solutions
INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
VALUES ('3135d50a-43dc-49f5-978e-4a130f1fed6f', 'Drainage Solutions', '#1E90FF', 7, true);

-- 9. Outdoor Lighting
INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
VALUES ('3135d50a-43dc-49f5-978e-4a130f1fed6f', 'Outdoor Lighting', '#FFD700', 8, true);

-- 10. Pressure Washing
INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
VALUES ('3135d50a-43dc-49f5-978e-4a130f1fed6f', 'Pressure Washing', '#00CED1', 9, true);

-- 11. Gutters & Downspouts
INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
VALUES ('3135d50a-43dc-49f5-978e-4a130f1fed6f', 'Gutters & Downspouts', '#696969', 10, true);

-- 12. Additional Services
INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
VALUES ('3135d50a-43dc-49f5-978e-4a130f1fed6f', 'Additional Services', '#9370DB', 11, true);

-- ========================================
-- CREATE SUBCATEGORIES FOR BOB
-- ========================================

-- Landscaping subcategories
INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Soil & Materials', 0, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Landscaping';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Plants & Shrubs', 1, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Landscaping';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Turf & Sod', 2, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Landscaping';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Garden Beds', 3, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Landscaping';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Landscape Design', 4, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Landscaping';

-- Hardscaping subcategories
INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Pavers & Walkways', 0, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Hardscaping';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Retaining Walls', 1, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Hardscaping';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Patios & Decks', 2, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Hardscaping';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Stone Work', 3, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Hardscaping';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Outdoor Kitchens', 4, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Hardscaping';

-- Concrete subcategories
INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Driveways', 0, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Concrete';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Sidewalks & Walkways', 1, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Concrete';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Patios', 2, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Concrete';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Foundations', 3, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Concrete';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Stamped/Decorative', 4, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Concrete';

-- Fencing subcategories
INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Wood Fence', 0, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Fencing';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Vinyl Fence', 1, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Fencing';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Chain Link', 2, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Fencing';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Aluminum Fence', 3, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Fencing';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Gate Installation', 4, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Fencing';

-- Tree Services subcategories
INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Tree Planting', 0, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Tree Services';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Tree Removal', 1, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Tree Services';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Stump Grinding', 2, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Tree Services';

-- Lawn Care & Maintenance subcategories
INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Mowing & Trimming', 0, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Lawn Care & Maintenance';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Fertilization & Weed Control', 1, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Lawn Care & Maintenance';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Aeration & Overseeding', 2, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Lawn Care & Maintenance';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Seasonal Cleanup', 3, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Lawn Care & Maintenance';

-- Irrigation subcategories
INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Sprinkler Systems', 0, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Irrigation';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Drip Irrigation', 1, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Irrigation';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Backflow Testing', 2, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Irrigation';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'System Repairs', 3, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Irrigation';

-- Drainage Solutions subcategories
INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'French Drains', 0, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Drainage Solutions';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Catch Basins', 1, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Drainage Solutions';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Grading & Erosion Control', 2, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Drainage Solutions';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Dry Wells', 3, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Drainage Solutions';

-- Outdoor Lighting subcategories
INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Path & Walkway Lighting', 0, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Outdoor Lighting';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Accent Lighting', 1, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Outdoor Lighting';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Security Lighting', 2, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Outdoor Lighting';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Low Voltage Systems', 3, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Outdoor Lighting';

-- Pressure Washing subcategories
INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Driveways & Sidewalks', 0, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Pressure Washing';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Decks & Patios', 1, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Pressure Washing';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Siding & Exterior Walls', 2, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Pressure Washing';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Roof Cleaning', 3, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Pressure Washing';

-- Gutters & Downspouts subcategories
INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Gutter Installation', 0, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Gutters & Downspouts';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Gutter Cleaning & Repair', 1, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Gutters & Downspouts';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Downspout Installation', 2, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Gutters & Downspouts';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Gutter Guards', 3, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Gutters & Downspouts';

-- Additional Services subcategories
INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Snow Removal', 0, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Additional Services';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Outdoor Structures', 1, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Additional Services';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Water Features', 2, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Additional Services';

INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
SELECT id, 'Masonry & Brickwork', 3, true FROM product_categories 
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f' AND name = 'Additional Services';