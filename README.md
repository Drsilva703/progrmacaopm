# Progrmacaopm

Precisamos de um sistema para organizar e controlar a programação das viagens para transportadora, considerando as seguintes informações:

- Dia de saída: definir a data e o dia da semana em que cada motorista realizará a saída.
- Duração das rotas: cadastrar a quantidade de dias que cada rota leva para ser concluída.
- Quantidade de saídas: permitir um número variável de saídas por dia, conforme a demanda da operação.
- Rotas variáveis: possibilitar a programação de diferentes rotas em um mesmo dia, com quantidades de saídas variáveis.
- Motoristas programados: definir qual motorista será responsável por cada viagem.
- Veículos programados: associar um veículo específico a cada saída, garantindo que não haja conflitos de programação.
- Programação por motorista, rota e data: permitir visualizar exatamente qual motorista realizará cada rota, com qual veículo e em qual dia será a saída.
- Controle de disponibilidade: considerar a duração de cada rota para calcular quando o motorista e o veículo estarão disponíveis novamente para uma nova viagem (Data de Chegada = Data de Saída + Duração).
- Visualização da programação: disponibilizar uma agenda diária, semanal e mensal, facilitando o acompanhamento das saídas, dos retornos e da disponibilidade dos recursos.
- Reproduzir o modelo operacional da planilha em anexo (Programação de viagem por data/dia da semana com: Pedido(s), Rota, Veículo/Placa, Motorista, Status ex: CARREGANDO, Duração em dias, Saída, Chegada calculada, Horário de Saída, e Plantão do dia).

O objetivo é criar um sistema inteligente de programação logística que permita planejar as viagens com antecedência, distribuir os motoristas e veículos de forma organizada, evitar conflitos de horários e garantir o controle de todas as operações da transportadora.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://progrmacaopm.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f6423aab-fb10-4e3a-ad22-ee86f4e53473).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
