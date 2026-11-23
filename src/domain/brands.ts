/**
 * Γνωστές μάρκες (οικιακές συσκευές, ηλεκτρονικά, εργαλεία, οχήματα) για την αναγνώριση από το κείμενο του εντύπου.
 * Η λίστα είναι βοήθημα, όχι περιορισμός: ο χρήστης γράφει ελεύθερα οποιαδήποτε μάρκα.
 * Πολύ σύντομα ή κοινά ονόματα (π.χ. «LG», «HP», «Candy») ταιριάζουν μόνο ως ολόκληρη λέξη — βλ. identify.ts.
 */
export const BRANDS: string[] = [
  'AEG', 'Acer', 'Amica', 'Anker', 'Apple', 'Ariston', 'Asus', 'Bauknecht', 'Beko', 'Black+Decker', 'Blaupunkt', 'Bosch',
  'Bose', 'Braun', 'Brother', 'Candy', 'Canon', 'Carrier', 'Daikin', 'Davoline', 'DeLonghi', 'Dell', 'DeWalt', 'Dyson',
  'Einhell', 'Electrolux', 'Elica', 'Epson', 'Eskimo', 'Faber', 'Franke', 'Fujifilm', 'Fujitsu', 'Garmin', 'Gorenje',
  'GoPro', 'Gree', 'Grundig', 'Haier', 'Hisense', 'Hitachi', 'Honor', 'Hoover', 'Hotpoint', 'HP', 'Huawei', 'Hyundai',
  'IKEA', 'Indesit', 'Inventor', 'iRobot', 'Izzy', 'JBL', 'Juro-Pro', 'Karcher', 'Kenwood', 'Korting', 'Krups', 'Lenovo',
  'LG', 'Liebherr', 'Logitech', 'Makita', 'Marshall', 'Miele', 'Midea', 'Mitsubishi', 'Morris', 'Motorola', 'Moulinex',
  'Neff', 'Nespresso', 'Nikon', 'Nilfisk', 'Nintendo', 'Nokia', 'OnePlus', 'Oppo', 'Oral-B', 'Panasonic', 'Philips',
  'Pioneer', 'Pitsos', 'Pyramis', 'Realme', 'Remington', 'Roborock', 'Rowenta', 'Russell Hobbs', 'Ryobi', 'Samsung',
  'Sencor', 'Sennheiser', 'Severin', 'Sharp', 'Siemens', 'Singer', 'Smeg', 'Sony', 'Stihl', 'TCL', 'Tefal', 'Teka',
  'Thomson', 'Toshiba', 'Toyotomi', 'TP-Link', 'Turbo-X', 'Ubiquiti', 'Vestel', 'Vivo', 'Whirlpool', 'Xiaomi',
  'Yamaha', 'Zanussi', 'Zyxel',
  // οχήματα: αυτοκίνητα, φορτηγά, μοτοσυκλέτες, σκούτερ, πατίνια, ποδήλατα. Κάποια ονόματα είναι και κοινές λέξεις
  // (Seat, Smart, Mini, Giant, Cube…): η εισαγωγή PDF ψάχνει μάρκα πρώτα στην ΠΡΩΤΗ σελίδα (εξώφυλλο), όπου ένα «Seat
  // belts» δεν εμφανίζεται συνήθως (απόφαση 23/11/2026: όλες οι μάρκες μέσα, χωρίς παραλείψεις).
  'Abarth', 'Acura', 'Aiways', 'Alfa Romeo', 'Alpine', 'Aprilia', 'Aston Martin', 'Audi', 'Benelli', 'Bentley', 'Beta',
  'Bianchi', 'BMW', 'Brompton', 'Buick', 'BYD', 'Cadillac', 'Cannondale', 'Canyon', 'CFMoto', 'Chery', 'Chevrolet',
  'Chrysler', 'Citroën', 'Cube', 'Cupra', 'Dacia', 'DAF', 'Daihatsu', 'Dodge', 'DS', 'Ducati', 'Ferrari', 'Fiat', 'Fisker',
  'Ford', 'Gas Gas', 'Gazelle', 'Geely', 'Genesis', 'Giant', 'GMC', 'Great Wall', 'Haibike', 'Harley-Davidson', 'Haval',
  'Honda', 'Husqvarna', 'Infiniti', 'Isuzu', 'Iveco', 'Jaecoo', 'Jaguar', 'Jeep', 'Kawasaki', 'KGM', 'Kia', 'KTM', 'Kymco',
  'Lada', 'Lamborghini', 'Lancia', 'Land Rover', 'Leapmotor', 'Lexus', 'Lincoln', 'Lotus', 'Lucid', 'Lynk & Co', 'MAN',
  'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz', 'Merida', 'MG', 'Mini', 'Moto Guzzi', 'MV Agusta', 'NIO', 'Ninebot',
  'Nissan', 'Omoda', 'Opel', 'Ora', 'Orbea', 'Peugeot', 'Piaggio', 'Pinarello', 'Polestar', 'Porsche', 'Proton', 'Ram',
  'Renault', 'Riese & Müller', 'Rivian', 'Rolls-Royce', 'Royal Enfield', 'Saab', 'Santa Cruz', 'Scania', 'Scott', 'SEAT',
  'Segway', 'Skoda', 'Smart', 'Specialized', 'SsangYong', 'Subaru', 'Suzuki', 'SYM', 'Tata', 'Tesla', 'Toyota', 'Trek',
  'Triumph', 'Vespa', 'VinFast', 'Volkswagen', 'Volvo', 'XPeng', 'Zeekr', 'Zero',
];
