import type { PrismaClient } from "@prisma/client";

type DollarsToCents = (dollars: number) => number;

type SeedCategory = {
  slug: string;
  name: string;
  sortOrder: number;
};

type SeedItem = {
  categorySlug: string;
  slug: string;
  name: string;
  description: string;
  price: number;
};

const categories: SeedCategory[] = [
  { slug: "hot-appetizers", name: "Hot Appetizers", sortOrder: 1 },
  { slug: "tandoori-clay-oven", name: "Tandoori Khazana From Clay Oven", sortOrder: 2 },
  { slug: "non-vegetable-dishes", name: "Non-Vegetable Dishes", sortOrder: 3 },
  { slug: "seafood", name: "Seafood", sortOrder: 4 },
  { slug: "vegetarian-specialties", name: "Vegetarian Specialties", sortOrder: 5 },
  { slug: "biryani-rice", name: "Biryani & Rice", sortOrder: 6 },
  { slug: "hakka-soups", name: "Hakka Soups", sortOrder: 7 },
  { slug: "hakka-appetizers", name: "Hakka Appetizers", sortOrder: 8 },
  { slug: "hakka-fried-rice", name: "Hakka Fried Rice", sortOrder: 9 },
  { slug: "hakka-noodles", name: "Hakka Noodles", sortOrder: 10 },
  { slug: "hakka-chicken", name: "Hakka Chicken", sortOrder: 11 },
  { slug: "hakka-fish-prawns", name: "Hakka Fish/Prawns", sortOrder: 12 },
  { slug: "hakka-vegetables", name: "Hakka Vegetables", sortOrder: 13 },
  { slug: "cold-appetizers", name: "Cold Appetizers", sortOrder: 14 },
  { slug: "mumbai-special", name: "Mumbai Special", sortOrder: 15 },
  { slug: "thalis", name: "Thalis", sortOrder: 16 },
  { slug: "side-orders", name: "Side Orders", sortOrder: 17 },
  { slug: "breads", name: "Breads", sortOrder: 18 },
  { slug: "desserts", name: "Special Indian Desserts", sortOrder: 19 },
  { slug: "drinks", name: "Distinctly Refreshing", sortOrder: 20 },
];

const items: SeedItem[] = [
  { categorySlug: "hot-appetizers", slug: "vegetable-samosa-2-pcs", name: "Vegetable Samosa (2 pcs)", description: "Patties stuffed with vegetables. Served with tamarind sauce.", price: 6.99 },
  { categorySlug: "hot-appetizers", slug: "vegetable-pakora-or-onion-bhaji-4-pcs", name: "Vegetable Pakora or Onion Bhaji (4 pcs)", description: "Fried mixed vegetable fritters. Served with tamarind sauce.", price: 6.99 },
  { categorySlug: "hot-appetizers", slug: "mixed-appetizer", name: "Mixed Appetizer", description: "Veg samosa, aloo tikki, spring roll and pakoras with curried chickpeas and tamarind chutney.", price: 14.99 },
  { categorySlug: "hot-appetizers", slug: "aloo-tikki", name: "Aloo Tikki", description: "Mashed potatoes with tangy spices, served with tamarind sauce.", price: 6.99 },
  { categorySlug: "hot-appetizers", slug: "aloo-tikki-chat", name: "Aloo Tikki Chat", description: "Mashed potatoes with chickpea gravy, tamarind, mint and yogurt.", price: 9.99 },
  { categorySlug: "hot-appetizers", slug: "fish-pakora-6-pcs", name: "Fish Pakora (6 pcs)", description: "Fried fish fritters.", price: 12.99 },

  { categorySlug: "tandoori-clay-oven", slug: "tandoori-chicken-with-bones-with-rice", name: "Tandoori Chicken (with Bones with Rice)", description: "Chicken leg marinated in yogurt and grilled in tandoori.", price: 13.99 },
  { categorySlug: "tandoori-clay-oven", slug: "chicken-tikka-boneless-white-meat", name: "Chicken Tikka (Boneless White Meat)", description: "Cubes of chicken marinated in yogurt with special spices.", price: 16.99 },
  { categorySlug: "tandoori-clay-oven", slug: "tandoori-mixed-grill", name: "Tandoori Mixed Grill", description: "Chicken tikka, reshmi tikka, chicken sheekh kebab and fish tikka, 4 pcs each.", price: 29.99 },
  { categorySlug: "tandoori-clay-oven", slug: "fish-tikka", name: "Fish Tikka", description: "Marinated and grilled with tandoori spices.", price: 18.99 },
  { categorySlug: "tandoori-clay-oven", slug: "achari-tikka-boneless-white-meat", name: "Achari Tikka (Boneless White Meat)", description: "Pieces of chicken marinated in yogurt and pickling flavor.", price: 16.99 },
  { categorySlug: "tandoori-clay-oven", slug: "reshmi-tikka-boneless-white-meat", name: "Reshmi Tikka (Boneless White Meat)", description: "Pieces of chicken marinated in cream with white pepper.", price: 16.99 },
  { categorySlug: "tandoori-clay-oven", slug: "paneer-shashlik", name: "Paneer Shashlik", description: "Pieces of homemade cheese marinated in special spices.", price: 15.99 },
  { categorySlug: "tandoori-clay-oven", slug: "chicken-sheekh-kabab", name: "Chicken Sheekh Kabab", description: "Ground chicken highly seasoned with special herbs and spices, roasted on skewers.", price: 14.99 },
  { categorySlug: "tandoori-clay-oven", slug: "tandoori-soya-tikka", name: "Tandoori Soya Tikka", description: "Cubes of soya marinated in yogurt and spices, grilled in the tandoor.", price: 14.99 },
  { categorySlug: "tandoori-clay-oven", slug: "malai-soya-tikka", name: "Malai Soya Tikka", description: "Soya chap marinated in malai flavors and grilled in tandoor.", price: 14.99 },
  { categorySlug: "tandoori-clay-oven", slug: "achari-soya-tikka", name: "Achari Soya Tikka", description: "Soya chap marinated in pickle masala yogurt and grilled in the tandoor.", price: 14.99 },

  { categorySlug: "non-vegetable-dishes", slug: "butter-chicken", name: "Butter Chicken", description: "Boneless tandoori chicken in exotic butter, tomato and cream sauce.", price: 18.99 },
  { categorySlug: "non-vegetable-dishes", slug: "chicken-tikka-masala-white-meat", name: "Chicken Tikka Masala (White Meat)", description: "Boneless chicken tikka cooked in thick sauce with onions and green peppers.", price: 19.99 },
  { categorySlug: "non-vegetable-dishes", slug: "karahi-chicken-goat-with-bone-lamb-beef", name: "Karahi Chicken / Goat With Bone (Lamb/Beef)", description: "Meat cooked with fresh green peppers, coriander and Indian spices with ginger flavor.", price: 18.99 },
  { categorySlug: "non-vegetable-dishes", slug: "saag-chicken-goat-with-bone-lamb-beef", name: "Saag Chicken / Goat With Bone (Lamb/Beef)", description: "Meat cooked in curried spinach.", price: 18.99 },
  { categorySlug: "non-vegetable-dishes", slug: "korma-chicken-goat-with-bone-lamb-beef", name: "Korma Chicken / Goat With Bone (Lamb/Beef)", description: "Meat cooked in a thick cream sauce with cashew nuts.", price: 18.99 },
  { categorySlug: "non-vegetable-dishes", slug: "vindaloo-chicken-goat-with-bone-lamb-beef", name: "Vindaloo Chicken / Goat With Bone (Lamb/Beef)", description: "Meat cooked in a hot tangy sauce with potatoes and vinegar.", price: 18.99 },
  { categorySlug: "non-vegetable-dishes", slug: "bhuna-chicken-goat-with-bone-lamb-beef", name: "Bhuna Chicken / Goat With Bone (Lamb/Beef)", description: "Meat cooked with tomato, onion and Indian spices.", price: 18.99 },
  { categorySlug: "non-vegetable-dishes", slug: "madras-curry-chicken-lamb-beef", name: "Madras Curry Chicken (Lamb/Beef)", description: "Meat cooked in spicy coconut sauce.", price: 18.99 },
  { categorySlug: "non-vegetable-dishes", slug: "goat-curry-with-bone", name: "Goat Curry with Bone", description: "Goat cooked in a special Indian sauce.", price: 18.99 },
  { categorySlug: "non-vegetable-dishes", slug: "curry-lamb-beef-chicken", name: "Curry Lamb/Beef/Chicken", description: "Meat cooked in a special Indian sauce.", price: 18.99 },

  { categorySlug: "seafood", slug: "fish-or-shrimp-masala", name: "Fish or Shrimp Masala", description: "Fillet fish or shrimp cooked in a thick sauce with onions and tomatoes.", price: 19.99 },
  { categorySlug: "seafood", slug: "shrimp-vindaloo", name: "Shrimp Vindaloo", description: "Shrimp cooked in a hot tangy sauce with potatoes, red chilies and vinegar.", price: 19.99 },
  { categorySlug: "seafood", slug: "karahi-shrimp", name: "Karahi Shrimp", description: "Shrimp cooked with fresh green peppers, tomatoes, coriander and Indian spices with ginger flavor.", price: 19.99 },
  { categorySlug: "seafood", slug: "butter-shrimp", name: "Butter Shrimp", description: "Shrimp cooked in tomato and cream sauce.", price: 19.99 },
  { categorySlug: "seafood", slug: "bhuna-shrimp", name: "Bhuna Shrimp", description: "Shrimp in a thick sauce with tomato, onion and special Indian spices.", price: 19.99 },
  { categorySlug: "seafood", slug: "korma-shrimp", name: "Korma Shrimp", description: "Shrimp cooked in a thick sauce with cashew nuts.", price: 19.99 },
  { categorySlug: "seafood", slug: "jalfrezi-shrimp", name: "Jalfrezi Shrimp", description: "Shrimp sauteed with tomatoes, onions and vinegar.", price: 19.99 },

  { categorySlug: "vegetarian-specialties", slug: "karahi-paneer-or-soya", name: "Karahi Paneer or Soya", description: "Fresh homemade cottage cheese or soya cooked in thick spicy sauce with green peppers.", price: 15.99 },
  { categorySlug: "vegetarian-specialties", slug: "palak-paneer", name: "Palak Paneer", description: "Curried spinach cooked with cubes of fresh homemade cottage cheese.", price: 16.99 },
  { categorySlug: "vegetarian-specialties", slug: "butter-soya-chap", name: "Butter Soya Chap", description: "Cubes of soya chap cooked in exotic cream and tomato sauce.", price: 15.99 },
  { categorySlug: "vegetarian-specialties", slug: "paneer-makhani", name: "Paneer Makhani", description: "Cubes of cottage cheese cooked in exotic cream and tomato sauce.", price: 15.99 },
  { categorySlug: "vegetarian-specialties", slug: "malai-kofta", name: "Malai Kofta", description: "Malai balls cooked in mild sauce.", price: 16.99 },
  { categorySlug: "vegetarian-specialties", slug: "bhindi-masala", name: "Bhindi Masala", description: "Fresh okra cooked with onions, tomatoes, potatoes and exotic spices.", price: 15.99 },
  { categorySlug: "vegetarian-specialties", slug: "chana-masala", name: "Chana Masala", description: "Spiced curried chickpeas served with either rice, one naan or two bhaturas.", price: 13.99 },
  { categorySlug: "vegetarian-specialties", slug: "aloo-gobi", name: "Aloo Gobi", description: "Fresh cauliflower cooked with potatoes, tomatoes, onions and spices.", price: 14.99 },
  { categorySlug: "vegetarian-specialties", slug: "daal-tarka", name: "Daal Tarka", description: "Lentils cooked with butter, ginger, tomatoes, coriander herbs and spices.", price: 13.99 },
  { categorySlug: "vegetarian-specialties", slug: "daal-makhani", name: "Daal Makhani", description: "Lentils cooked with herbs, butter, cream and spices.", price: 13.99 },
  { categorySlug: "vegetarian-specialties", slug: "mixed-vegetable", name: "Mixed Vegetable", description: "Mixed vegetable curry cooked with herbs and spices.", price: 13.99 },
  { categorySlug: "vegetarian-specialties", slug: "vegetable-jalfrezi", name: "Vegetable Jalfrezi", description: "Large chopped vegetables sauteed in vinegar, herbs and spices.", price: 13.99 },
  { categorySlug: "vegetarian-specialties", slug: "vegetable-korma", name: "Vegetable Korma", description: "Mixed vegetables cooked in thick cream sauce with cashew nuts.", price: 14.99 },
  { categorySlug: "vegetarian-specialties", slug: "vegetable-vindaloo", name: "Vegetable Vindaloo", description: "Mixed vegetables cooked in hot tangy sauce.", price: 14.99 },
  { categorySlug: "vegetarian-specialties", slug: "chana-bhatura", name: "Chana Bhatura", description: "Chickpea curry served with bhatura.", price: 15.99 },

  { categorySlug: "biryani-rice", slug: "biryani-chicken-goat-lamb-beef", name: "Biryani (Chicken, Goat With Bone, Lamb or Beef)", description: "Basmati rice delicacy with a medley of meat, served with raita.", price: 16.99 },
  { categorySlug: "biryani-rice", slug: "bombay-special-mixed-biryani", name: "Bombay Special Mixed Biryani", description: "Combination of lamb, chicken and shrimp cooked in basmati rice.", price: 18.99 },
  { categorySlug: "biryani-rice", slug: "vegetable-biryani", name: "Vegetable Biryani", description: "Rice delicacy with vegetables and spices, served with raita.", price: 14.99 },
  { categorySlug: "biryani-rice", slug: "shrimp-biryani", name: "Shrimp Biryani", description: "Basmati rice delicacy with shrimp, served with raita.", price: 18.99 },
  { categorySlug: "biryani-rice", slug: "jeera-rice", name: "Jeera Rice", description: "Basmati pulao rice with cumin seeds.", price: 4.99 },

  { categorySlug: "hakka-soups", slug: "vegetable-chicken-sweet-corn-soup", name: "Vegetable / Chicken Sweet Corn Soup", description: "Classic creamy soup.", price: 7.99 },
  { categorySlug: "hakka-soups", slug: "vegetable-chicken-hot-sour-soup", name: "Vegetable / Chicken Hot & Sour Soup", description: "Tangy soup with chopped vegetables.", price: 7.99 },
  { categorySlug: "hakka-soups", slug: "vegetable-chicken-manchow-soup", name: "Vegetable / Chicken Manchow Soup", description: "Thick soup with chopped vegetables, served with noodles.", price: 7.99 },
  { categorySlug: "hakka-soups", slug: "seafood-soup", name: "Seafood Soup", description: "Shrimp and fish soup with vegetables.", price: 8.99 },

  { categorySlug: "hakka-appetizers", slug: "vegetable-spring-roll-4-pcs", name: "Vegetable Spring Roll (4 pcs)", description: "Vegetables cooked in sauce and filled in thin rice based wraps.", price: 6.99 },
  { categorySlug: "hakka-appetizers", slug: "chicken-lollipops-or-chilli-wings-8-10-pcs", name: "Chicken Lollipops or Chilli Wings (8-10 pcs)", description: "Chicken wings cooked with onion, green pepper, ginger, garlic, fresh chilli, soy and Chinese sauce.", price: 15.99 },
  { categorySlug: "hakka-appetizers", slug: "chicken-momos", name: "Chicken Momos", description: "Homemade chicken dumplings served with special hot chutney.", price: 14.99 },
  { categorySlug: "hakka-appetizers", slug: "veg-momos", name: "Veg Momos", description: "Vegetable dumplings served with special hot chutney.", price: 13.99 },
  { categorySlug: "hakka-appetizers", slug: "chilli-chicken-momos", name: "Chilli Chicken Momos", description: "Chicken momos tossed in chilli sauce.", price: 15.99 },
  { categorySlug: "hakka-appetizers", slug: "butter-chicken-momo", name: "Butter Chicken Momo", description: "Chicken momos in butter chicken sauce.", price: 15.99 },
  { categorySlug: "hakka-appetizers", slug: "butter-masala-momo", name: "Butter Masala Momo", description: "Momos in butter masala sauce.", price: 15.99 },
  { categorySlug: "hakka-appetizers", slug: "jhol-momo-8-pcs", name: "Jhol Momo (8 pcs)", description: "Momos served in jhol sauce.", price: 16.99 },
  { categorySlug: "hakka-appetizers", slug: "veggie-manchurian-dry", name: "Veggie Manchurian Dry", description: "Deep fried vegetable balls tossed with chopped onions, ginger and Manchurian sauce.", price: 14.99 },
  { categorySlug: "hakka-appetizers", slug: "chilli-paneer-dry", name: "Chilli Paneer Dry", description: "Deep fried paneer cubes tossed with chopped onions and ginger.", price: 15.99 },
  { categorySlug: "hakka-appetizers", slug: "szechuan-paneer-dry", name: "Szechuan Paneer Dry", description: "Deep fried paneer cubes tossed with chopped onions, ginger and sauce.", price: 15.99 },
  { categorySlug: "hakka-appetizers", slug: "chilli-chicken-fish-dry", name: "Chilli Chicken/Fish Dry", description: "Deep fried cubes with chopped onions, ginger and bell peppers.", price: 15.99 },
  { categorySlug: "hakka-appetizers", slug: "chicken-fish-manchurian-dry", name: "Chicken/Fish Manchurian Dry", description: "Deep fried meat tossed with chopped onions, ginger and Manchurian sauce.", price: 15.99 },
  { categorySlug: "hakka-appetizers", slug: "szechuan-chicken-fish-dry", name: "Szechuan Chicken/Fish Dry", description: "Deep fried cubes tossed with chopped onions, ginger and sauce.", price: 15.99 },
  { categorySlug: "hakka-appetizers", slug: "chicken-hakka-style-chefs-special", name: "Chicken Hakka Style (Chef's Special)", description: "Chicken stir fried with bell peppers.", price: 15.99 },
  { categorySlug: "hakka-appetizers", slug: "french-fries", name: "French Fries", description: "Crispy fries.", price: 5.99 },

  { categorySlug: "hakka-fried-rice", slug: "vegetable-fried-rice", name: "Vegetable Fried Rice", description: "Vegetables cooked with rice and sauce.", price: 13.99 },
  { categorySlug: "hakka-fried-rice", slug: "chicken-fried-rice", name: "Chicken Fried Rice", description: "Chicken cooked with rice and sauce.", price: 14.99 },
  { categorySlug: "hakka-fried-rice", slug: "egg-fried-rice", name: "Egg Fried Rice", description: "Eggs cooked with rice and sauce.", price: 14.99 },
  { categorySlug: "hakka-fried-rice", slug: "prawns-fried-rice", name: "Prawns Fried Rice", description: "Prawns cooked with rice and sauce.", price: 15.99 },
  { categorySlug: "hakka-fried-rice", slug: "mixed-fried-rice-chefs-special", name: "Mixed Fried Rice (Chef's Special)", description: "Cooked with egg, shrimp and chicken.", price: 16.99 },

  { categorySlug: "hakka-noodles", slug: "vegetable-noodles", name: "Vegetable Noodles", description: "Vegetables cooked with noodles and sauce.", price: 13.99 },
  { categorySlug: "hakka-noodles", slug: "chicken-noodles", name: "Chicken Noodles", description: "Chicken cooked with noodles and sauce.", price: 14.99 },
  { categorySlug: "hakka-noodles", slug: "egg-noodles", name: "Egg Noodles", description: "Eggs cooked with noodles and sauce.", price: 14.99 },
  { categorySlug: "hakka-noodles", slug: "prawns-noodles", name: "Prawns Noodles", description: "Prawns cooked with noodles and sauce.", price: 16.99 },
  { categorySlug: "hakka-noodles", slug: "mixed-noodles-chefs-special", name: "Mixed Noodles (Chef's Special)", description: "Cooked with egg, shrimp and chicken.", price: 16.99 },

  { categorySlug: "hakka-chicken", slug: "chilli-chicken", name: "Chilli Chicken", description: "Boneless chicken cooked with onion, green pepper, ginger, garlic, fresh chilli, soy and Chinese sauce.", price: 15.99 },
  { categorySlug: "hakka-chicken", slug: "chicken-manchurian", name: "Chicken Manchurian", description: "Deep fried chicken cubes tossed with chopped onions, ginger and Manchurian sauce.", price: 15.99 },
  { categorySlug: "hakka-chicken", slug: "hot-garlic-garlic-chicken", name: "Hot Garlic/Garlic Chicken", description: "Chicken cubes tossed with chopped onions, ginger and garlic sauce.", price: 15.99 },
  { categorySlug: "hakka-chicken", slug: "honey-garlic-chicken", name: "Honey Garlic Chicken", description: "Chicken cubes tossed with chopped onions, ginger and honey sauce.", price: 16.99 },

  { categorySlug: "hakka-fish-prawns", slug: "chilli-fish-prawns", name: "Chilli Fish/Prawns", description: "Fish or prawns cooked with onion, green pepper, ginger, garlic, fresh chilli, soy and Chinese sauce.", price: 16.99 },
  { categorySlug: "hakka-fish-prawns", slug: "fish-prawns-manchurian", name: "Fish/Prawns Manchurian", description: "Deep fried cubes tossed with chopped onions, ginger and Manchurian sauce.", price: 16.99 },
  { categorySlug: "hakka-fish-prawns", slug: "hot-garlic-garlic-fish-prawns", name: "Hot Garlic/Garlic Fish/Prawns", description: "Cubes tossed with chopped onions, ginger and garlic sauce.", price: 16.99 },
  { categorySlug: "hakka-fish-prawns", slug: "honey-garlic-fish-prawns", name: "Honey Garlic Fish/Prawns", description: "Cubes tossed with chopped onions, ginger and honey sauce.", price: 16.99 },

  { categorySlug: "hakka-vegetables", slug: "chilli-paneer-soyachap", name: "Chilli Paneer/Soyachap", description: "Cooked with onion, green pepper, ginger, garlic, fresh chilli, soy and Chinese sauce.", price: 16.99 },
  { categorySlug: "hakka-vegetables", slug: "veggie-manchurian", name: "Veggie Manchurian", description: "Deep fried cubes tossed with chopped onions, ginger and Manchurian sauce.", price: 15.99 },
  { categorySlug: "hakka-vegetables", slug: "paneer-soyachap-manchurian", name: "Paneer/Soyachap Manchurian", description: "Deep fried cubes tossed with chopped onions, ginger and Manchurian sauce.", price: 15.99 },
  { categorySlug: "hakka-vegetables", slug: "hot-garlic-paneer", name: "Hot Garlic Paneer", description: "Cubes tossed with chopped onions, ginger and garlic sauce.", price: 16.99 },

  { categorySlug: "cold-appetizers", slug: "bhel-puri", name: "Bhel Puri", description: "Indian street food made with puffed rice.", price: 9.0 },
  { categorySlug: "cold-appetizers", slug: "dahi-bhalla", name: "Dahi Bhalla", description: "Fried lentil dumplings served in yogurt, topped with chutney and spices.", price: 9.0 },
  { categorySlug: "cold-appetizers", slug: "pani-puri", name: "Pani Puri", description: "Round hollow balls filled with chickpeas and flavored water.", price: 9.0 },
  { categorySlug: "cold-appetizers", slug: "dahi-poori", name: "Dahi Poori", description: "Crispy shells filled with chickpeas, potatoes and spices, topped with yogurt and tamarind sauce.", price: 9.0 },
  { categorySlug: "cold-appetizers", slug: "sev-puri", name: "Sev Puri", description: "Crunchy wafers topped with potatoes, onions, crispy noodles and tamarind sauce.", price: 9.0 },

  { categorySlug: "mumbai-special", slug: "pav-bhaji", name: "Pav Bhaji", description: "Toasted bun with butter, served with mashed vegetable stuffing and Indian spices.", price: 9.0 },
  { categorySlug: "thalis", slug: "vegetarian-thali", name: "Vegetarian Thali", description: "Vegetarian thali platter.", price: 14.99 },
  { categorySlug: "thalis", slug: "non-vegetarian-thali", name: "Non-Vegetarian Thali", description: "Non-vegetarian thali platter.", price: 15.99 },

  { categorySlug: "side-orders", slug: "green-salad", name: "Green Salad", description: "Fresh lettuce, cucumber, onions, tomatoes and lemon.", price: 6.99 },
  { categorySlug: "side-orders", slug: "mango-tamarind-chutney", name: "Mango/Tamarind Chutney", description: "Side chutney.", price: 2.99 },
  { categorySlug: "side-orders", slug: "papadum", name: "Papadum", description: "Thin grilled crispy lentil crackers.", price: 1.99 },
  { categorySlug: "side-orders", slug: "raita", name: "Raita", description: "Yogurt with grated cucumber, potato and spices.", price: 4.49 },
  { categorySlug: "side-orders", slug: "mixed-pickle", name: "Mixed Pickle", description: "Mixed pickle side.", price: 2.99 },

  { categorySlug: "breads", slug: "naan", name: "Naan", description: "Fine flour bread.", price: 2.99 },
  { categorySlug: "breads", slug: "garlic-naan", name: "Garlic Naan", description: "Fine flour bread with garlic toppings.", price: 3.99 },
  { categorySlug: "breads", slug: "tandoori-roti", name: "Tandoori Roti", description: "Whole wheat bread.", price: 2.99 },
  { categorySlug: "breads", slug: "paratha", name: "Paratha", description: "Lacha or mint whole wheat layered bread.", price: 4.99 },
  { categorySlug: "breads", slug: "aloo-paratha", name: "Aloo Paratha", description: "Whole wheat bread stuffed with potatoes.", price: 5.99 },
  { categorySlug: "breads", slug: "amritsari-kulcha", name: "Amritsari Kulcha", description: "Fine flour bread stuffed with Indian spices, mashed potato and paneer.", price: 5.99 },

  { categorySlug: "desserts", slug: "rasmalai", name: "Rasmalai", description: "2 pcs milk delight.", price: 5.99 },
  { categorySlug: "desserts", slug: "ice-cream", name: "Ice Cream", description: "Mango, vanilla, strawberry or chocolate.", price: 4.99 },
  { categorySlug: "desserts", slug: "gulab-jamun", name: "Gulab Jamun", description: "2 pcs brown milk balls cooked in rose water syrup.", price: 5.99 },

  { categorySlug: "drinks", slug: "lassi", name: "Lassi", description: "Sweet or salty homemade yogurt drink.", price: 4.99 },
  { categorySlug: "drinks", slug: "mango-lassi", name: "Mango Lassi", description: "Sweet mango yogurt drink.", price: 5.99 },
  { categorySlug: "drinks", slug: "mango-shake", name: "Mango Shake", description: "Sweet mango and milk drink.", price: 5.99 },
  { categorySlug: "drinks", slug: "juices", name: "Juices", description: "Mango, pineapple and coconut.", price: 4.99 },
  { categorySlug: "drinks", slug: "spring-water", name: "Spring Water", description: "Bottled spring water.", price: 1.99 },
  { categorySlug: "drinks", slug: "perrier-water", name: "Perrier Water", description: "Sparkling water.", price: 2.99 },
  { categorySlug: "drinks", slug: "soft-drinks", name: "Soft Drinks", description: "Soft drink.", price: 2.99 },
  { categorySlug: "drinks", slug: "masala-chai", name: "Masala Chai (Special Indian Masala Tea)", description: "Special Indian masala tea.", price: 2.99 },
  { categorySlug: "drinks", slug: "iced-tea", name: "Iced Tea", description: "Iced tea.", price: 2.99 },
];

export async function seedMenu(prisma: PrismaClient, dollarsToCents: DollarsToCents) {
  const categoryBySlug = new Map<string, string>();

  for (const category of categories) {
    const saved = await prisma.menuCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        sortOrder: category.sortOrder,
        isActive: true,
      },
      create: {
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        isActive: true,
      },
    });

    categoryBySlug.set(category.slug, saved.id);
  }

  for (const item of items) {
    const categoryId = categoryBySlug.get(item.categorySlug);
    if (!categoryId) throw new Error(`Missing category for ${item.slug}`);

    await prisma.menuItem.upsert({
      where: { slug: item.slug },
      update: {
        categoryId,
        name: item.name,
        description: item.description,
        priceCents: dollarsToCents(item.price),
        taxable: true,
        isActive: true,
        imageUrl: null,
        imageAlt: item.name,
      },
      create: {
        categoryId,
        slug: item.slug,
        name: item.name,
        description: item.description,
        priceCents: dollarsToCents(item.price),
        taxable: true,
        isActive: true,
        imageUrl: null,
        imageAlt: item.name,
      },
    });
  }

  await prisma.menuItem.updateMany({
    where: { slug: { notIn: items.map((item) => item.slug) } },
    data: { isActive: false },
  });

  await prisma.menuCategory.updateMany({
    where: { slug: { notIn: categories.map((category) => category.slug) } },
    data: { isActive: false },
  });

  console.log(`✅ Seed menu ready: ${categories.length} categories, ${items.length} active items`);
}
