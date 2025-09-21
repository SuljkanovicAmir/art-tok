export default class ArtImagesService {

   public async fetchImages () {
        try {
            const response = await fetch(`https://api.harvardartmuseums.org/object?apikey=6c508855-dcac-4b25-a405-42f8581b8070&size=10&page=1&sort=random&hasimage=1`) 
            const data = await response.json();
            console.log(data)
            return data;
        } catch (error){
            console.error('Error fetching art images', error);
            throw error;
        }
    }
   
}