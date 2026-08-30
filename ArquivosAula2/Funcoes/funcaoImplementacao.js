const compose = (f,g) => x => f(g(x));

// Celsius para Fahrenheit
const celFar = (c) => c * 1.8 + 32;

// Kelvin para Celsius
const kelCel = (k) => k - 273;

// Kelvin para Fahrenheit
const kelFar = compose(celFar,kelCel);

console.log(kelFar(300));