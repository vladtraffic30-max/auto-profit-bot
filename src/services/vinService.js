const axios = require('axios');

async function decodeVin(vin) {
  const cleanVin = vin.trim().toUpperCase();

  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${cleanVin}?format=json`;

  const response = await axios.get(url);
  const data = response.data.Results[0];

  return {
    vin: cleanVin,
    brand: data.Make || '',
    model: data.Model || '',
    year: data.ModelYear || '',
    bodyClass: data.BodyClass || '',
    engine: data.EngineModel || data.EngineConfiguration || '',
    engineCylinders: data.EngineCylinders || '',
    displacement: data.DisplacementL || '',
    fuelType: data.FuelTypePrimary || '',
    driveType: data.DriveType || '',
    transmission: data.TransmissionStyle || '',
  };
}

module.exports = { decodeVin };