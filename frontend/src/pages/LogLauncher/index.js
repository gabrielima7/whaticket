import React from 'react';
import { FiGitBranch, FiCode } from 'react-icons/fi';
import styled from 'styled-components';

const Container = styled.div`
  padding: 2rem;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  max-width: 800px;
  margin: 0 auto;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 2.5rem;
`;

const Title = styled.h2`
  color: #2c3e50;
  font-size: 2rem;
  margin-bottom: 0.5rem;
  font-weight: 600;
`;

const Subtitle = styled.p`
  color: #7f8c8d;
  font-size: 1rem;
`;

const VersionCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  border-left: 4px solid #3498db;
`;

const VersionTitle = styled.h3`
  color: #2c3e50;
  font-size: 1.3rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ChangeList = styled.ul`
  padding-left: 1rem;
  list-style-type: none;
`;

const ChangeItem = styled.li`
  margin-bottom: 0.75rem;
  padding-left: 1.5rem;
  position: relative;
  color: #34495e;
  line-height: 1.5;
  
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.5rem;
    width: 8px;
    height: 8px;
    background-color: #3498db;
    border-radius: 50%;
  }
`;

const STATIC_RELEASE_NOTES = [
  {
    version: "v2.5.0 — Hardening & Multi-Tenancy Security",
    changes: [
      "Mitigação contra BOLA / IDOR em relatórios, filas, usuários, tags e mensagens.",
      "Hardening de upload de arquivos com restrição estrita de path traversal e sanitização de extensões perigosas.",
      "Controle de concorrência com transações ACID pessimistas no atendimento e criação de tickets.",
      "Eliminação de timers zumbis e fechamento gracioso de sockets Baileys na reconexão.",
      "Remoção de rotinas externas de telemetria e validação de assinatura em webhooks de pagamento."
    ]
  },
  {
    version: "v2.0.0 — Estabilidade de WhatsApp & Performance",
    changes: [
      "Integração e suporte com Baileys Multi-Device.",
      "Melhorias na fila Redis Bull e sincronização de mensagens em tempo real.",
      "Otimização de consultas Sequelize e suporte a campanhas em massa."
    ]
  }
];

const VersionLog = () => {
  return (
    <Container>
      <Header>
        <FiGitBranch size={48} color="#3498db" style={{ marginBottom: '1rem' }} />
        <Title>Histórico de Atualizações</Title>
        <Subtitle>Notas de versão internas do sistema</Subtitle>
      </Header>
      
      {STATIC_RELEASE_NOTES.map(({ version, changes }) => (
        <VersionCard key={version}>
          <VersionTitle>
            <FiCode color="#3498db" />
            {version}
          </VersionTitle>
          <ChangeList>
            {changes.map((change, index) => (
              <ChangeItem key={index}>
                {change}
              </ChangeItem>
            ))}
          </ChangeList>
        </VersionCard>
      ))}
    </Container>
  );
};

export default VersionLog;
