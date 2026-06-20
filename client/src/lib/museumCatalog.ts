export type MuseumCatalogItem = {
  id: string;
  museum_id: string;
  name: string;
  location: string;
  state: string;
  category: string;
  price: number;
  prices: {
    Adult: number;
    Child: number;
    'Senior Citizen': number;
    Student: number;
    Professor: number;
    'Researcher/Scientist': number;
  };
  description?: string;
  imageUrl?: string;
  virtualTourUrl?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt?: string;
};
