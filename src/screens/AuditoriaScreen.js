import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import {
  Appbar,
  Card,
  Text,
  Chip,
  TextInput,
  Button,
  ActivityIndicator,
  Divider,
  Switch,
} from 'react-native-paper';
import api from '../services/api';

const ACOES = ['POST', 'PUT', 'DELETE'];

export default function AuditoriaScreen({ navigation }) {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filtros
  const [modulos, setModulos] = useState([]);
  const [dispositivos, setDispositivos] = useState([]);
  const [filtroModulo, setFiltroModulo] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroDispositivo, setFiltroDispositivo] = useState(''); // dispositivo/origem
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  // Estatísticas e configuração
  const [stats, setStats] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    carregarModulos();
    carregarDispositivos();
    carregarRegistros(1);
    carregarStats();
    carregarConfigs();
  }, []);

  const carregarModulos = async () => {
    try {
      const resp = await api.get('/api/auditoria/modulos');
      const data = resp.data;
      setModulos(Array.isArray(data) ? data : (data?.modulos || []));
    } catch (error) {
      console.error('Erro ao carregar módulos:', error);
    }
  };

  const carregarDispositivos = async () => {
    try {
      const resp = await api.get('/api/auditoria/dispositivos');
      const data = resp.data;
      setDispositivos(Array.isArray(data) ? data : (data?.dispositivos || []));
    } catch (error) {
      console.error('Erro ao carregar dispositivos:', error);
    }
  };

  const carregarStats = async () => {
    try {
      const params = {};
      if (filtroDataInicio) params.dataInicio = filtroDataInicio;
      if (filtroDataFim) params.dataFim = filtroDataFim;
      const resp = await api.get('/api/auditoria/stats', { params });
      setStats(resp.data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const carregarConfigs = async () => {
    try {
      let resp = await api.get('/api/auditoria-config');
      if (!resp.data || resp.data.length === 0) {
        await api.post('/api/auditoria-config/init');
        resp = await api.get('/api/auditoria-config');
      }
      setConfigs(resp.data || []);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const toggleConfig = async (modulo, ativo) => {
    try {
      await api.put(`/api/auditoria-config/${modulo}`, { ativo: !ativo });
      setConfigs((prev) =>
        prev.map((c) => (c.modulo === modulo ? { ...c, ativo: !ativo } : c))
      );
    } catch (error) {
      console.error('Erro ao atualizar configuração:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a configuração');
    }
  };

  const carregarRegistros = async (pageArg = 1, replace = true) => {
    setLoading(true);
    try {
      const params = { page: pageArg, limit: 50 };
      if (filtroModulo) params.modulo = filtroModulo;
      if (filtroAcao) params.acao = filtroAcao;
      if (filtroUsuario) params.userName = filtroUsuario;
      if (filtroDispositivo) params.dispositivo = filtroDispositivo;
      if (filtroDataInicio) params.dataInicio = filtroDataInicio;
      if (filtroDataFim) params.dataFim = filtroDataFim;
      const resp = await api.get('/api/auditoria', { params });
      const novos = resp.data.registros || [];
      setRegistros((prev) => (replace ? novos : [...prev, ...novos]));
      setTotal(resp.data.total || 0);
      setTotalPages(resp.data.totalPages || 1);
      setPage(pageArg);
    } catch (error) {
      console.error('Erro ao carregar auditoria:', error);
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltros = () => {
    carregarRegistros(1);
    carregarStats();
  };

  const limparFiltros = () => {
    setFiltroModulo('');
    setFiltroAcao('');
    setFiltroUsuario('');
    setFiltroDispositivo('');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setTimeout(() => {
      carregarRegistros(1);
      carregarStats();
    }, 0);
  };

  const formatarData = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR');
  };

  const corAcao = (acao) => {
    if (acao === 'POST') return '#4CAF50';
    if (acao === 'PUT') return '#FF9800';
    if (acao === 'DELETE') return '#F44336';
    return '#2196F3';
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
        <Appbar.Content title="Auditoria" titleStyle={styles.headerTitle} />
        <Appbar.Action
          icon={showConfig ? 'cog' : 'cog-outline'}
          color="#fff"
          onPress={() => setShowConfig((v) => !v)}
        />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => carregarRegistros(1)}
            tintColor="#2196F3"
          />
        }
      >
        {/* ===== Filtros ===== */}
        <Card style={styles.filtroCard}>
          <Card.Content>
            <Text style={styles.filtroLabel}>Módulo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                <Chip
                  selected={filtroModulo === ''}
                  onPress={() => setFiltroModulo('')}
                  style={styles.chip}
                >
                  Todos
                </Chip>
                {(Array.isArray(modulos) ? modulos : []).map((m) => (
                  <Chip
                    key={m}
                    selected={filtroModulo === m}
                    onPress={() => setFiltroModulo(m)}
                    style={styles.chip}
                  >
                    {m}
                  </Chip>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.filtroLabel}>Ação</Text>
            <View style={styles.chipRow}>
              <Chip
                selected={filtroAcao === ''}
                onPress={() => setFiltroAcao('')}
                style={styles.chip}
              >
                Todas
              </Chip>
              {ACOES.map((a) => (
                <Chip
                  key={a}
                  selected={filtroAcao === a}
                  onPress={() => setFiltroAcao(a)}
                  style={styles.chip}
                >
                  {a}
                </Chip>
              ))}
            </View>

            <Text style={styles.filtroLabel}>Usuário</Text>
            <TextInput
              value={filtroUsuario}
              onChangeText={setFiltroUsuario}
              mode="outlined"
              dense
              placeholder="Nome do usuário"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />

            <View style={styles.dataRow}>
              <View style={styles.dataCol}>
                <Text style={styles.filtroLabel}>Data início</Text>
                <TextInput
                  value={filtroDataInicio}
                  onChangeText={setFiltroDataInicio}
                  mode="outlined"
                  dense
                  placeholder="AAAA-MM-DD"
                  style={styles.input}
                  theme={{ colors: { background: '#2a2a2a' } }}
                />
              </View>
              <View style={styles.dataCol}>
                <Text style={styles.filtroLabel}>Data fim</Text>
                <TextInput
                  value={filtroDataFim}
                  onChangeText={setFiltroDataFim}
                  mode="outlined"
                  dense
                  placeholder="AAAA-MM-DD"
                  style={styles.input}
                  theme={{ colors: { background: '#2a2a2a' } }}
                />
              </View>
            </View>

            <Text style={styles.filtroLabel}>Dispositivo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                <Chip
                  selected={filtroDispositivo === ''}
                  onPress={() => setFiltroDispositivo('')}
                  style={styles.chip}
                >
                  Todos
                </Chip>
                {(Array.isArray(dispositivos) ? dispositivos : []).map((disp) => (
                  <Chip
                    key={disp}
                    selected={filtroDispositivo === disp}
                    onPress={() => setFiltroDispositivo(disp)}
                    style={styles.chip}
                    icon="cellphone-link"
                  >
                    {disp}
                  </Chip>
                ))}
              </View>
            </ScrollView>

            <View style={styles.filtroBotoes}>
              <Button mode="outlined" onPress={limparFiltros} textColor="#fff" style={styles.filtroBtn}>
                Limpar
              </Button>
              <Button mode="contained" onPress={aplicarFiltros} style={styles.filtroBtn}>
                Filtrar
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* ===== Configuração de Auditoria ===== */}
        {showConfig && (
          <Card style={styles.filtroCard}>
            <Card.Content>
              <Text style={styles.configTitulo}>Configuração de Auditoria</Text>
              <Text style={styles.configSub}>
                Ative ou desative o registro de auditoria por módulo.
              </Text>
              {configs.length === 0 ? (
                <ActivityIndicator style={{ marginTop: 12 }} color="#2196F3" />
              ) : (
                configs.map((c) => (
                  <View key={c.modulo} style={styles.configRow}>
                    <Text style={styles.configModulo}>{c.modulo}</Text>
                    <Switch
                      value={!!c.ativo}
                      onValueChange={() => toggleConfig(c.modulo, c.ativo)}
                      color="#4CAF50"
                    />
                  </View>
                ))
              )}
            </Card.Content>
          </Card>
        )}

        {/* ===== Estatísticas ===== */}
        {stats && (
          <Card style={styles.statsCard}>
            <Card.Content>
              <Text style={styles.statsTitulo}>
                {stats.totalRegistros ?? 0} registro(s) no período
              </Text>
              <View style={styles.statsRow}>
                {['POST', 'PUT', 'DELETE'].map((a) => {
                  const item = (stats.porAcao || []).find((x) => x.acao === a);
                  return (
                    <View key={a} style={styles.statItem}>
                      <Text style={[styles.statCount, { color: corAcao(a) }]}>
                        {item ? item.count : 0}
                      </Text>
                      <Text style={styles.statLabel}>{a}</Text>
                    </View>
                  );
                })}
              </View>
            </Card.Content>
          </Card>
        )}

        <Text style={styles.totalTexto}>
          {registros.length} de {total} registro(s)
        </Text>

        {/* ===== Registros ===== */}
        {loading && registros.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 24 }} color="#2196F3" />
        ) : registros.length === 0 ? (
          <Text style={styles.semDados}>Nenhum registro encontrado</Text>
        ) : (
          registros.map((reg) => (
            <Card key={reg.id} style={styles.regCard}>
              <Card.Content>
                <View style={styles.regHeader}>
                  <Chip
                    style={{ backgroundColor: corAcao(reg.acao) }}
                    textStyle={{ color: '#fff', fontSize: 11 }}
                  >
                    {reg.acao}
                  </Chip>
                  <Text style={styles.regModulo}>{reg.modulo}</Text>
                </View>
                <Text style={styles.regDescricao}>{reg.descricao || reg.rota}</Text>
                <Divider style={styles.divider} />
                <View style={styles.regMetaRow}>
                  <Text style={styles.regMeta}>👤 {reg.userName || 'Sistema'}</Text>
                  <Text style={styles.regMeta}>🕒 {formatarData(reg.createdAt)}</Text>
                </View>
                {reg.dispositivo && (
                  <Text style={styles.regMeta}>📱 {reg.dispositivo}</Text>
                )}
                {reg.ip && <Text style={styles.regMetaIp}>IP: {reg.ip}</Text>}
              </Card.Content>
            </Card>
          ))
        )}

        {page < totalPages && (
          <Button
            mode="text"
            textColor="#2196F3"
            onPress={() => carregarRegistros(page + 1, false)}
            style={{ marginVertical: 12 }}
          >
            Carregar mais
          </Button>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  dataRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dataCol: {
    flex: 1,
  },
  configTitulo: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  configSub: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  configModulo: {
    color: '#fff',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  statsCard: {
    marginTop: 12,
    backgroundColor: '#1a1a1a',
  },
  statsTitulo: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statCount: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#aaa',
    fontSize: 11,
    marginTop: 2,
  },
  header: {
    backgroundColor: '#1a1a1a',
  },
  headerTitle: {
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  filtroCard: {
    marginTop: 12,
    backgroundColor: '#1a1a1a',
  },
  filtroLabel: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: '#2a2a2a',
  },
  input: {
    marginBottom: 4,
  },
  filtroBotoes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  filtroBtn: {
    flex: 1,
    marginHorizontal: 4,
  },
  totalTexto: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 12,
    marginBottom: 6,
  },
  semDados: {
    textAlign: 'center',
    marginTop: 24,
    color: '#aaa',
  },
  regCard: {
    marginBottom: 10,
    backgroundColor: '#1a1a1a',
  },
  regHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  regModulo: {
    color: '#2196F3',
    fontWeight: 'bold',
    marginLeft: 8,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  regDescricao: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
  },
  divider: {
    marginVertical: 8,
    backgroundColor: '#333',
  },
  regMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  regMeta: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 2,
  },
  regMetaIp: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
});
