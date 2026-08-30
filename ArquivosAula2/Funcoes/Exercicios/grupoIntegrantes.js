class Grupo {
  titulo;
  integrantes;
  saudaIntegrantes() {
    this.integrantes.forEach(function (nome) {
      console.log(`Alo ${nome} de ${this.titulo}!`);
    }, this); //precisa desse ultimo 'this'
  }
}

const grupo = new Grupo();
grupo.titulo = "Melhores Amigos";
grupo.integrantes = ["Ana", "Bruno", "Carlos", "Daniel"];
grupo.saudaIntegrantes();
