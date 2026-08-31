const get = propriedade => (objeto => objeto[propriedade]);
const getId = get("id");
let objetos = [{id:1 , nome: "Ana"},{id:2 , nome:"Bruno"}];
// console.log(objetos.map(getId));
let ids = objetos.map(getId);
console.log(ids);