import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import * as microsoftTeams from '@microsoft/teams-js';
import { QueryClient, QueryClientProvider } from 'react-query';
import App from './App';
import { TeamsProvider } from 'utils/TeamsProvider';
import './index.css';
import reportWebVitals from './reportWebVitals';

const queryClient = new QueryClient()

ReactDOM.render(
  <React.StrictMode>
    <TeamsProvider microsoftTeams={microsoftTeams}>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </BrowserRouter>
    </TeamsProvider>
  </React.StrictMode>,
  document.getElementById('root'),
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
