import { readFileSync } from "node:fs";
import { curry, filter, map, pipe, sort, sortBy, take } from "ramda";

try {
  const cities = JSON.parse(readFileSync("cities.json", "utf-8"));

  const CelsiusToKelvin = (c) => c + 273.15;
  const KelvinToCelsius = (k) => k - 273.15;

  const ranges = {
    Kelvin: map(CelsiusToKelvin, [20, 30]),
    humidity: [30, 70],
  };

  const withinRange = (range, value) => range[0] <= value && value <= range[1];
  const byClimatePredicate = curry((ranges, city) => {
    const { temp = 0, humidity = 0 } = city;
    return (
      withinRange(ranges.Kelvin, temp) && withinRange(ranges.humidity, humidity)
    );
  });
  const filterByClimate = filter(byClimatePredicate);
  const temperatureConverter = KelvinToCelsius;
  const updateTemperature = curry((temperatureConverter, city) => ({
    ...city,
    temp: Math.round(temperatureConverter(city.temp)),
  }));
  const updateTemperatureOfCities = map(
    updateTemperature(temperatureConverter),
  );
  const citySorter = (cities) => sortBy((city) => city.cost)(cities);
  const cityGrabber = take(5);
  const pipeline = [
    filterByClimate,
    updateTemperatureOfCities,
    citySorter,
    cityGrabber,
  ];

  // Resultado
  const result = pipe(...pipeline)(cities);
  console.log(result);
} catch (error) {
  console.log("Falha de leitura de arquivo");
}