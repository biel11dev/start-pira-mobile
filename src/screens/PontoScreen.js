import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  Appbar,
  Card,
  Button,
  Text,
  Portal,
  Modal,
  Menu,
  Chip,
} from 'react-native-paper';
import api from '../services/api';

export default function PontoScreen({ navigation }) {
  const [funcionarios, setFuncionarios] = useState([]);
  const [dadosSemanais, setDadosSemanais] = useState([]);
  const [dadosMensais, setDadosMensais] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('daily');
  const [funcionarioSelecionadoId, setFuncionarioSelecionadoId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().split('T')[0]);
  const [semanaRangeSelecionado, setSemanaRangeSelecionado] = useState(null);
  
  const [valoresTemp, setValoresTemp] = useState({});
  
  const [modalMetaSemanal, setModalMetaSemanal] = useState(false);
  const [metaSemanalFuncionario, setMetaSemanalFuncionario] = useState(null);
  const [metaSemanalValores, setMetaSemanalValores] = useState({
    metaHoras: '',
    bonificacao: '',
    valorHora: '',
    metasExtras: []
  });
  const [semanaParaMeta, setSemanaParaMeta] = useState(null);
  const [metaAtualSemana, setMetaAtualSemana] = useState(null);
  const [descontoValeSemana, setDescontoValeSemana] = useState(0);
  const [descontoValeMes, setDescontoValeMes] = useState(0);
  const [rangeSemana, setRangeSemana] = useState(null); // { inicio, fim, nome }
  const [rangeMes, setRangeMes] = useState(null); // { inicio, fim, nome }

  // Modal de detalhamento dos gastos (Gastos Bar) do funcionário
  const [gastosModalVisible, setGastosModalVisible] = useState(false);
  const [gastosModalLoading, setGastosModalLoading] = useState(false);
  const [gastosModalData, setGastosModalData] = useState(null);
  const [gastosModalTitulo, setGastosModalTitulo] = useState('');

  useEffect(() => {
    carregarFuncionarios();
  }, []);

  useEffect(() => {
    if (abaAtiva === 'daily') {
      carregarFuncionarios();
    } else if (abaAtiva === 'weekly') {
      carregarDadosSemanais();
    } else if (abaAtiva === 'monthly') {
      carregarDadosMensais();
    }
  }, [dataSelecionada, abaAtiva, semanaRangeSelecionado, funcionarioSelecionadoId]);

  const carregarFuncionarios = async () => {
    setLoading(true);
    try {
      const resFunc = await api.get('/api/employees');
      const funcionariosData = resFunc.data;

      if (!funcionarioSelecionadoId && funcionariosData.length > 0) {
        setFuncionarioSelecionadoId(funcionariosData[0].id);
      }

      const resPontos = await api.get('/api/daily-points');
      const pontosData = resPontos.data;

      const funcAtualizados = funcionariosData.map((func) => {
        const pontoHoje = pontosData.find(
          (p) => p.employeeId === func.id && p.date.startsWith(dataSelecionada)
        );

        const entry = pontoHoje?.entry ? pontoHoje.entry.split('T')[1].slice(0, 5) : '';
        const exit = pontoHoje?.exit ? pontoHoje.exit.split('T')[1].slice(0, 5) : '';

        return {
          ...func,
          entry,
          exit,
          gateOpen: pontoHoje?.gateOpen ? pontoHoje.gateOpen.split('T')[1].slice(0, 5) : '',
          workedHours: calcularHorasTrabalhadas(entry, exit),
          valorHora: func.valorHora || 0,
          pontoId: pontoHoje?.id,
        };
      });

      setFuncionarios(funcAtualizados);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
      Alert.alert('Erro', 'Não foi possível carregar os funcionários');
    } finally {
      setLoading(false);
    }
  };

  const obterRangeSemana = (dataRef) => {
    const dataAtual = typeof dataRef === 'string' ? parseISODate(dataRef) : dataRef;
    const ano = dataAtual.getFullYear();
    const mes = dataAtual.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    
    const diaSemana = dataAtual.getDay();
    const offsetInicio = diaSemana === 0 ? -6 : 2 - diaSemana;
    const dataInicio = new Date(dataAtual);
    dataInicio.setDate(dataAtual.getDate() + offsetInicio);

    if (dataInicio < primeiroDia) {
      dataInicio.setTime(primeiroDia.getTime());
    }

    const dataFim = new Date(dataInicio);
    dataFim.setDate(dataInicio.getDate() + 5);
    
    if (dataFim > ultimoDia) {
      dataFim.setTime(ultimoDia.getTime());
    }

    return { dataInicio, dataFim };
  };

  const carregarDadosSemanais = async () => {
    setLoading(true);
    try {
      let dataInicio, dataFim;
      if (semanaRangeSelecionado) {
        dataInicio = semanaRangeSelecionado.dataInicio;
        dataFim = semanaRangeSelecionado.dataFim;
      } else {
        const range = obterRangeSemana(dataSelecionada);
        dataInicio = range.dataInicio;
        dataFim = range.dataFim;
      }
      
      const pad = (n) => n.toString().padStart(2, '0');
      const startDateStr = `${dataInicio.getFullYear()}-${pad(dataInicio.getMonth() + 1)}-${pad(dataInicio.getDate())}`;
      const endDateStr = `${dataFim.getFullYear()}-${pad(dataFim.getMonth() + 1)}-${pad(dataFim.getDate())}`;

      const resFunc = await api.get('/api/employees');
      const resPontos = await api.get(`/api/daily-points?startDate=${startDateStr}&endDate=${endDateStr}`);

      const pontosData = resPontos.data;

      const dadosAtualizados = resFunc.data.map((func) => {
        const pontos = pontosData.filter((p) => {
          const pontoDate = p.date.split('T')[0];
          return p.employeeId === func.id && pontoDate >= startDateStr && pontoDate <= endDateStr;
        });
        return {
          ...func,
          pontos,
        };
      });

      setDadosSemanais(dadosAtualizados);
      
      if (funcionarioSelecionadoId) {
        await carregarMetaSemana(funcionarioSelecionadoId, startDateStr);
        const funcSel = resFunc.data.find((f) => f.id === funcionarioSelecionadoId);
        if (funcSel?.name) {
          const wkStart = new Date(dataInicio);
          wkStart.setHours(0, 0, 0, 0);
          const wkEnd = new Date(wkStart);
          wkEnd.setDate(wkEnd.getDate() + 5); // terça -> domingo
          wkEnd.setHours(23, 59, 59, 999);
          setDescontoValeSemana(await buscarDescontoVale(funcSel.name, wkStart, wkEnd));
          setRangeSemana({ inicio: wkStart, fim: wkEnd, nome: funcSel.name });
        } else {
          setDescontoValeSemana(0);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados semanais:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarDadosMensais = async () => {
    setLoading(true);
    const mesAtual = dataSelecionada.slice(0, 7);
    try {
      const resFunc = await api.get('/api/employees');
      const resPontos = await api.get(`/api/daily-points?month=${mesAtual}`);

      const pontosData = resPontos.data;

      const dadosAtualizados = resFunc.data.map((func) => {
        const pontos = pontosData.filter((p) => p.employeeId === func.id && p.date.startsWith(mesAtual));
        return {
          ...func,
          pontos,
        };
      });

      setDadosMensais(dadosAtualizados);

      if (funcionarioSelecionadoId) {
        const funcSel = resFunc.data.find((f) => f.id === funcionarioSelecionadoId);
        if (funcSel?.name) {
          const [ano, mes] = mesAtual.split('-').map(Number);
          const inicioMes = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
          const fimMes = new Date(ano, mes, 0, 23, 59, 59, 999);
          setDescontoValeMes(await buscarDescontoVale(funcSel.name, inicioMes, fimMes));
          setRangeMes({ inicio: inicioMes, fim: fimMes, nome: funcSel.name });
        } else {
          setDescontoValeMes(0);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados mensais:', error);
    } finally {
      setLoading(false);
    }
  };

  // Buscar desconto de vale (Gastos Bar: produtos no vale + vales em dinheiro) do funcionário no período
  const buscarDescontoVale = async (nome, inicio, fim) => {
    try {
      const res = await api.get(
        `/api/pdv-gastos-bar/funcionario/${encodeURIComponent(nome)}`,
        { params: { startDate: inicio.toISOString(), endDate: fim.toISOString() } }
      );
      return parseFloat(res.data?.total) || 0;
    } catch (error) {
      console.error('Erro ao buscar gastos bar do funcionário:', error);
      return 0;
    }
  };

  // Abre o modal com o detalhamento dos gastos (Gastos Bar) do período
  const abrirGastosDetalhes = async (range, titulo) => {
    if (!range?.nome) return;
    setGastosModalTitulo(titulo);
    setGastosModalData(null);
    setGastosModalLoading(true);
    setGastosModalVisible(true);
    try {
      const res = await api.get(
        `/api/pdv-gastos-bar/funcionario/${encodeURIComponent(range.nome)}`,
        { params: { startDate: range.inicio.toISOString(), endDate: range.fim.toISOString() } }
      );
      setGastosModalData(res.data || { total: 0, itens: [] });
    } catch (error) {
      console.error('Erro ao carregar detalhes dos gastos:', error);
      setGastosModalData({ total: 0, itens: [] });
    } finally {
      setGastosModalLoading(false);
    }
  };

  // Normaliza metasExtras (pode vir como array, string JSON ou null)
  const normalizarMetasExtras = (raw) => {
    if (!raw) return [];
    try {
      const arr = Array.isArray(raw) ? raw : JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  };

  // Calcula a bonificação ganha considerando o tier principal + metas extras.
  // Premia o MAIOR nível atingido (mesma regra do web).
  const calcularBonus = (totalHoras, metaHoras, bonificacao, metasExtras) => {
    const allTiers = [];
    const mh = parseFloat(metaHoras) || 0;
    const bn = parseFloat(bonificacao) || 0;
    if (mh > 0 && bn > 0) allTiers.push({ metaHoras: mh, bonificacao: bn });
    (normalizarMetasExtras(metasExtras)).forEach((t) => {
      const tmh = parseFloat(t.metaHoras);
      const tbn = parseFloat(t.bonificacao);
      if (tmh > 0 && tbn > 0) allTiers.push({ metaHoras: tmh, bonificacao: tbn });
    });
    allTiers.sort((a, b) => b.metaHoras - a.metaHoras);
    for (const tier of allTiers) {
      if (totalHoras >= tier.metaHoras) {
        return { bonificacaoGanha: tier.bonificacao, temBonificacao: true };
      }
    }
    return { bonificacaoGanha: 0, temBonificacao: false };
  };

  const carregarMetaSemana = async (employeeId, weekStart) => {
    try {
      const res = await api.get(`/api/employee-weekly-meta/${employeeId}?weekStart=${weekStart}`);
      const func = funcionarios.find(f => f.id === employeeId) || {};
      if (res.data) {
        setMetaAtualSemana({
          metaHoras: res.data.metaHoras || 0,
          bonificacao: res.data.bonificacao || 0,
          valorHora: res.data.valorHora || 0,
          metasExtras: normalizarMetasExtras(res.data.metasExtras ?? func.metasExtras),
          isDefault: false
        });
      } else {
        const func = funcionarios.find(f => f.id === employeeId) || {};
        setMetaAtualSemana({
          metaHoras: func.metaHoras || 40,
          bonificacao: func.bonificacao || 0,
          valorHora: func.valorHora || 0,
          metasExtras: normalizarMetasExtras(func.metasExtras),
          isDefault: true
        });
      }
    } catch (error) {
      const func = funcionarios.find(f => f.id === employeeId) || {};
      setMetaAtualSemana({
        metaHoras: func.metaHoras || 40,
        bonificacao: func.bonificacao || 0,
        valorHora: func.valorHora || 0,
        metasExtras: normalizarMetasExtras(func.metasExtras),
        isDefault: true
      });
    }
  };

  const atualizarPonto = async (employeeId) => {
    try {
      const valoresAtualizados = valoresTemp[employeeId] || {};
      const func = funcionarios.find(f => f.id === employeeId);
      
      const entry = valoresAtualizados.entry || func.entry;
      const exit = valoresAtualizados.exit || func.exit;

      const dadosParaAtualizar = {
        date: dataSelecionada,
        employeeId: employeeId,
        entry: entry,
        exit: exit,
      };

      if (func.pontoId) {
        await api.put(`/api/daily-points/${func.pontoId}`, dadosParaAtualizar);
      } else {
        await api.post('/api/daily-points', dadosParaAtualizar);
      }

      Alert.alert('Sucesso', 'Ponto atualizado com sucesso!');
      carregarFuncionarios();
      setValoresTemp({});
    } catch (error) {
      console.error('Erro ao atualizar ponto:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o ponto');
    }
  };

  const gerarHorario = async () => {
    if (!funcionarioSelecionadoId) {
      Alert.alert('Aviso', 'Selecione um funcionário primeiro!');
      return;
    }

    const agora = new Date();
    const horaAtual = agora.toTimeString().slice(0, 5);

    try {
      const func = funcionarios.find(f => f.id === funcionarioSelecionadoId);
      
      if (!func.entry) {
        const dadosParaAtualizar = {
          date: dataSelecionada,
          employeeId: funcionarioSelecionadoId,
          entry: horaAtual,
          exit: func.exit || '',
        };

        if (func.pontoId) {
          await api.put(`/api/daily-points/${func.pontoId}`, dadosParaAtualizar);
        } else {
          await api.post('/api/daily-points', dadosParaAtualizar);
        }
        
        Alert.alert('Sucesso', `Entrada registrada: ${horaAtual}`);
      } 
      else if (!func.exit) {
        const dadosParaAtualizar = {
          date: dataSelecionada,
          employeeId: funcionarioSelecionadoId,
          entry: func.entry,
          exit: horaAtual,
        };

        await api.put(`/api/daily-points/${func.pontoId}`, dadosParaAtualizar);
        Alert.alert('Sucesso', `Saída registrada: ${horaAtual}`);
      } else {
        Alert.alert('Aviso', 'Entrada e saída já foram registradas');
      }
      
      carregarFuncionarios();
    } catch (error) {
      console.error('Erro ao gerar horário:', error);
      Alert.alert('Erro', 'Não foi possível registrar o horário');
    }
  };

  const handleDiaAnterior = () => {
    const novaData = parseISODate(dataSelecionada);
    novaData.setDate(novaData.getDate() - 1);
    setDataSelecionada(novaData.toISOString().split('T')[0]);
  };

  const handleProximoDia = () => {
    const novaData = parseISODate(dataSelecionada);
    novaData.setDate(novaData.getDate() + 1);
    setDataSelecionada(novaData.toISOString().split('T')[0]);
  };

  const handleMesAnterior = () => {
    const novaData = parseISODate(dataSelecionada);
    novaData.setMonth(novaData.getMonth() - 1);
    setDataSelecionada(novaData.toISOString().split('T')[0]);
  };

  const handleProximoMes = () => {
    const novaData = parseISODate(dataSelecionada);
    novaData.setMonth(novaData.getMonth() + 1);
    setDataSelecionada(novaData.toISOString().split('T')[0]);
  };

  const abrirModalMetaSemanal = (func, weekStart) => {
    setMetaSemanalFuncionario(func);
    setSemanaParaMeta(weekStart);
    setMetaSemanalValores({
      metaHoras: func.metaHoras ? func.metaHoras.toString() : '40',
      bonificacao: func.bonificacao ? func.bonificacao.toString() : '0',
      valorHora: func.valorHora ? func.valorHora.toString() : '0',
      metasExtras: normalizarMetasExtras(func.metasExtras)
    });
    setModalMetaSemanal(true);
  };

  const salvarMetaSemanal = async () => {
    if (!metaSemanalFuncionario || !semanaParaMeta) return;

    try {
      const weekStartDate = new Date(semanaParaMeta);
      const year = weekStartDate.getFullYear();
      const month = weekStartDate.getMonth() + 1;

      await api.post('/api/employee-weekly-meta', {
        employeeId: metaSemanalFuncionario.id,
        weekStart: semanaParaMeta,
        year,
        month,
        metaHoras: parseFloat(metaSemanalValores.metaHoras) || 0,
        bonificacao: parseFloat(metaSemanalValores.bonificacao) || 0,
        valorHora: parseFloat(metaSemanalValores.valorHora) || 0,
        metasExtras: (metaSemanalValores.metasExtras || [])
          .filter((t) => t.metaHoras !== '' && t.bonificacao !== '')
          .map((t) => ({
            metaHoras: parseFloat(t.metaHoras) || 0,
            bonificacao: parseFloat(t.bonificacao) || 0,
          }))
      });

      Alert.alert('Sucesso', 'Meta semanal definida com sucesso!');
      setModalMetaSemanal(false);
      
      setMetaAtualSemana({
        metaHoras: parseFloat(metaSemanalValores.metaHoras) || 0,
        bonificacao: parseFloat(metaSemanalValores.bonificacao) || 0,
        valorHora: parseFloat(metaSemanalValores.valorHora) || 0,
        metasExtras: normalizarMetasExtras(metaSemanalValores.metasExtras),
        isDefault: false
      });
      
      if (abaAtiva === 'weekly') {
        await carregarDadosSemanais();
      }
    } catch (error) {
      console.error('Erro ao salvar meta semanal:', error);
      Alert.alert('Erro', 'Não foi possível salvar a meta semanal');
    }
  };

  const calcularHorasTrabalhadas = (entry, exit) => {
    if (!entry || !exit) return '0h 0m';

    const entryTime = new Date(`1970-01-01T${entry}:00`);
    let exitTime = new Date(`1970-01-01T${exit}:00`);

    if (exitTime < entryTime) {
      exitTime.setDate(exitTime.getDate() + 1);
    }

    const diffMs = exitTime - entryTime;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${diffHours}h ${diffMinutes}m`;
  };

  const calcularValorDiario = (entry, exit, valorHora) => {
    if (!entry || !exit || !valorHora) return 0;

    const horasString = calcularHorasTrabalhadas(entry, exit);
    const match = horasString.match(/(\d+)h\s+(\d+)m/);
    
    if (!match) return 0;
    
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const totalHours = hours + (minutes / 60);
    
    return totalHours * parseFloat(valorHora);
  };

  const formatarDataComSemana = (dateString) => {
    const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    const d = parseISODate(dateString);
    const dia = d.getDate().toString().padStart(2, '0');
    const mes = (d.getMonth() + 1).toString().padStart(2, '0');
    const ano = d.getFullYear().toString().slice(-2);
    const semana = dias[d.getDay()];
    return `${dia}/${mes}/${ano} - ${semana}`;
  };

  const parseISODate = (isoString) => {
    const [year, month, day] = isoString.split('T')[0].split('-');
    return new Date(Number(year), Number(month) - 1, Number(day));
  };

  const obterDadosFiltrados = () => {
    if (abaAtiva === 'daily') {
      return funcionarios.filter(f => f.id === funcionarioSelecionadoId);
    } else if (abaAtiva === 'weekly') {
      return dadosSemanais.filter(f => f.id === funcionarioSelecionadoId);
    } else {
      return dadosMensais.filter(f => f.id === funcionarioSelecionadoId);
    }
  };

  const obterSemanasDoMes = () => {
    const dataAtual = parseISODate(dataSelecionada);
    const ano = dataAtual.getFullYear();
    const mes = dataAtual.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);

    const semanas = [];
    
    let primeiraTerca = new Date(primeiroDia);
    while (primeiraTerca.getDay() !== 2) {
      primeiraTerca.setDate(primeiraTerca.getDate() + 1);
      if (primeiraTerca > ultimoDia) break;
    }

    if (primeiraTerca <= ultimoDia) {
      let atual = new Date(primeiraTerca);
      while (atual <= ultimoDia) {
        const inicio = new Date(atual);
        const fim = new Date(inicio);
        fim.setDate(inicio.getDate() + 5);
        
        if (fim > ultimoDia) {
          fim.setTime(ultimoDia.getTime());
        }
        
        semanas.push({ inicio: new Date(inicio), fim: new Date(fim) });
        atual.setDate(atual.getDate() + 7);
      }
    }
    
    if (semanas.length === 0) {
      semanas.push({ inicio: new Date(primeiroDia), fim: new Date(ultimoDia) });
    }

    return semanas;
  };

  const funcionarioSelecionado = funcionarios.find(f => f.id === funcionarioSelecionadoId);
  const dadosFiltrados = obterDadosFiltrados();

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
        <Appbar.Content title="Gerenciamento de Ponto" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.label}>Selecionar Colaborador:</Text>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setMenuVisible(true)}
                  style={styles.selectButton}
                  textColor="#fff"
                >
                  {funcionarioSelecionado ? `${funcionarioSelecionado.name} - ${funcionarioSelecionado.position || 'N/A'}` : 'Selecione um funcionário'}
                </Button>
              }
            >
              {funcionarios.map((func) => (
                <Menu.Item
                  key={func.id}
                  onPress={() => {
                    setFuncionarioSelecionadoId(func.id);
                    setMenuVisible(false);
                  }}
                  title={`${func.name} - ${func.position || 'N/A'}`}
                />
              ))}
            </Menu>
          </Card.Content>
        </Card>

        {abaAtiva === 'daily' && (
          <Button
            mode="contained"
            onPress={gerarHorario}
            style={styles.gerarButton}
            icon="clock-plus"
          >
            Gerar Horário
          </Button>
        )}

        <View style={styles.navegacaoData}>
          <Button
            mode="contained"
            onPress={abaAtiva === 'monthly' ? handleMesAnterior : handleDiaAnterior}
            style={styles.navButton}
          >
            {abaAtiva === 'monthly' ? '<< Mês' : '< Dia'}
          </Button>
          <Text style={styles.dataText}>
            {new Date(dataSelecionada + 'T00:00:00').toLocaleDateString('pt-BR')}
          </Text>
          <Button
            mode="contained"
            onPress={abaAtiva === 'monthly' ? handleProximoMes : handleProximoDia}
            style={styles.navButton}
          >
            {abaAtiva === 'monthly' ? 'Mês >>' : 'Dia >'}
          </Button>
        </View>

        <View style={styles.abasContainer}>
          <Button
            mode={abaAtiva === 'daily' ? 'contained' : 'outlined'}
            onPress={() => setAbaAtiva('daily')}
            style={styles.abaButton}
            textColor={abaAtiva === 'daily' ? '#fff' : '#2196F3'}
          >
            Diária
          </Button>
          <Button
            mode={abaAtiva === 'weekly' ? 'contained' : 'outlined'}
            onPress={() => setAbaAtiva('weekly')}
            style={styles.abaButton}
            textColor={abaAtiva === 'weekly' ? '#fff' : '#2196F3'}
          >
            Semanal
          </Button>
          <Button
            mode={abaAtiva === 'monthly' ? 'contained' : 'outlined'}
            onPress={() => setAbaAtiva('monthly')}
            style={styles.abaButton}
            textColor={abaAtiva === 'monthly' ? '#fff' : '#2196F3'}
          >
            Mensal
          </Button>
        </View>

        {abaAtiva === 'weekly' && (
          <ScrollView
            horizontal
            style={styles.semanasScroll}
            showsHorizontalScrollIndicator={false}
          >
            {obterSemanasDoMes().map((semana, idx) => {
              const label = `${semana.inicio.toLocaleDateString('pt-BR')} - ${semana.fim.toLocaleDateString('pt-BR')}`;
              const selected = parseISODate(dataSelecionada);
              selected.setHours(0, 0, 0, 0);
              const isActive = selected >= semana.inicio && selected <= semana.fim;
              
              return (
                <Button
                  key={idx}
                  mode={isActive ? 'contained' : 'outlined'}
                  onPress={() => {
                    setDataSelecionada(semana.inicio.toISOString().split('T')[0]);
                    setSemanaRangeSelecionado({ dataInicio: semana.inicio, dataFim: semana.fim });
                  }}
                  style={[styles.semanaButton, isActive && styles.semanaButtonActive]}
                  textColor={isActive ? '#fff' : '#2196F3'}
                >
                  {label}
                </Button>
              );
            })}
          </ScrollView>
        )}

        {abaAtiva === 'weekly' && funcionarioSelecionado && metaAtualSemana && (
          <Card style={styles.metaCard}>
            <Card.Content>
              <Text style={styles.metaTitle}>
                {funcionarioSelecionado.name.toUpperCase()} - {(funcionarioSelecionado.position || 'N/A').toUpperCase()}
              </Text>
              <View style={styles.metaInfo}>
                <Text style={styles.metaText}>Meta: {metaAtualSemana.metaHoras}h</Text>
                <Text style={styles.metaText}>Bônus: R$ {metaAtualSemana.bonificacao.toFixed(2)}</Text>
                <Text style={styles.metaText}>Valor/h: R$ {metaAtualSemana.valorHora.toFixed(2)}</Text>
              </View>
              {metaAtualSemana.isDefault && <Text style={styles.metaBadge}>(Padrão)</Text>}
              <Button
                mode="contained"
                onPress={() => {
                  let tuesdayDateStr;
                  if (semanaRangeSelecionado) {
                    const pad = (n) => n.toString().padStart(2, '0');
                    tuesdayDateStr = `${semanaRangeSelecionado.dataInicio.getFullYear()}-${pad(semanaRangeSelecionado.dataInicio.getMonth() + 1)}-${pad(semanaRangeSelecionado.dataInicio.getDate())}`;
                  } else {
                    const currentDate = new Date(dataSelecionada);
                    const dayOfWeek = currentDate.getDay();
                    let tuesdayDate = new Date(currentDate);
                    
                    if (dayOfWeek === 0) {
                      tuesdayDate.setDate(tuesdayDate.getDate() - 5);
                    } else if (dayOfWeek === 1) {
                      tuesdayDate.setDate(tuesdayDate.getDate() - 6);
                    } else {
                      tuesdayDate.setDate(tuesdayDate.getDate() - (dayOfWeek - 2));
                    }
                    
                    tuesdayDateStr = tuesdayDate.toISOString().split('T')[0];
                  }
                  
                  abrirModalMetaSemanal(funcionarioSelecionado, tuesdayDateStr);
                }}
                style={styles.defineMetaButton}
                icon="target"
              >
                🎯 Definir Meta da Semana
              </Button>
            </Card.Content>
          </Card>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Carregando...</Text>
          </View>
        ) : (
          <View style={styles.tabelaScroll}>
            {abaAtiva === 'daily' && dadosFiltrados.map((func) => (
              <Card key={func.id} style={styles.pontoCard}>
                <Card.Content>
                  <Text style={styles.pontoData}>{formatarDataComSemana(dataSelecionada)}</Text>
                  
                  <View style={styles.inputRow}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Entrada:</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={valoresTemp[func.id]?.entry !== undefined ? valoresTemp[func.id].entry : func.entry}
                        onChangeText={(text) => {
                          setValoresTemp((prev) => ({
                            ...prev,
                            [func.id]: { ...prev[func.id], entry: text },
                          }));
                        }}
                        placeholder="--:--"
                        placeholderTextColor="#666"
                      />
                    </View>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Saída:</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={valoresTemp[func.id]?.exit !== undefined ? valoresTemp[func.id].exit : func.exit}
                        onChangeText={(text) => {
                          setValoresTemp((prev) => ({
                            ...prev,
                            [func.id]: { ...prev[func.id], exit: text },
                          }));
                        }}
                        placeholder="--:--"
                        placeholderTextColor="#666"
                      />
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoText}>Horas: {func.workedHours}</Text>
                    <Text style={styles.infoText}>
                      Valor: R$ {calcularValorDiario(
                        valoresTemp[func.id]?.entry || func.entry,
                        valoresTemp[func.id]?.exit || func.exit,
                        func.valorHora
                      ).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </Text>
                  </View>

                  <Button
                    mode="contained"
                    onPress={() => atualizarPonto(func.id)}
                    style={styles.atualizarButton}
                    icon="check"
                  >
                    Atualizar
                  </Button>
                </Card.Content>
              </Card>
            ))}

            {abaAtiva === 'weekly' && dadosFiltrados.map((func) => {
              const pontos = func.pontos || [];
              const pontosSorted = [...pontos].sort((a, b) => new Date(a.date) - new Date(b.date));
              
              let totalValorSemana = 0;
              let totalHorasSemana = 0;

              pontosSorted.forEach((ponto) => {
                const entry = ponto.entry ? ponto.entry.split('T')[1].slice(0, 5) : '';
                const exit = ponto.exit ? ponto.exit.split('T')[1].slice(0, 5) : '';
                const valorDia = calcularValorDiario(entry, exit, func.valorHora);
                totalValorSemana += valorDia;
                
                const workedHours = calcularHorasTrabalhadas(entry, exit);
                const match = workedHours.match(/(\d+)h\s+(\d+)m/);
                if (match) {
                  totalHorasSemana += parseInt(match[1]) + (parseInt(match[2]) / 60);
                }
              });

              const metaHoras = metaAtualSemana?.metaHoras || 0;
              const bonificacao = metaAtualSemana?.bonificacao || 0;
              const { bonificacaoGanha, temBonificacao } = calcularBonus(
                totalHorasSemana,
                metaHoras,
                bonificacao,
                metaAtualSemana?.metasExtras
              );
              const descontoVale = descontoValeSemana || 0;
              const valorTotal = totalValorSemana + bonificacaoGanha - descontoVale;

              return (
                <View key={func.id}>
                  {pontosSorted.map((ponto) => {
                    const entry = ponto.entry ? ponto.entry.split('T')[1].slice(0, 5) : '';
                    const exit = ponto.exit ? ponto.exit.split('T')[1].slice(0, 5) : '';
                    const workedHours = calcularHorasTrabalhadas(entry, exit);
                    const valorDia = calcularValorDiario(entry, exit, func.valorHora);

                    return (
                      <Card key={ponto.date} style={styles.pontoCard}>
                        <Card.Content>
                          <Text style={styles.pontoData}>{formatarDataComSemana(ponto.date)}</Text>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoText}>Entrada: {entry || '--:--'}</Text>
                            <Text style={styles.infoText}>Saída: {exit || '--:--'}</Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoText}>Horas: {workedHours}</Text>
                            <Text style={styles.infoText}>Valor: R$ {valorDia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
                          </View>
                        </Card.Content>
                      </Card>
                    );
                  })}
                  
                  <Card style={styles.resumoCard}>
                    <Card.Content>
                      <Text style={styles.resumoLabel}>Resumo horas:</Text>
                      <Text style={styles.resumoHoras}>{Math.floor(totalHorasSemana)}h {Math.round((totalHorasSemana % 1) * 60)}m</Text>
                      <Text style={styles.resumoValor}>R$ {totalValorSemana.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
                      {temBonificacao && (
                        <Text style={styles.bonusValor}>+ R$ {bonificacaoGanha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} 🏆</Text>
                      )}
                      {descontoVale > 0 && (
                        <Text style={styles.descontoValor}>- R$ {descontoVale.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} 💵</Text>
                      )}
                      {descontoVale > 0 && (
                        <>
                          <Text style={styles.gastoResumoTexto}>Gastos Bar a descontar no fim da semana</Text>
                          <Button
                            mode="outlined"
                            compact
                            icon="format-list-bulleted"
                            onPress={() => abrirGastosDetalhes(rangeSemana, `Gastos da semana — ${func.name}`)}
                            style={styles.gastoDetalheBtn}
                            textColor="#ff6b6b"
                          >
                            Ver gastos detalhados
                          </Button>
                        </>
                      )}
                      {(temBonificacao || descontoVale > 0) ? (
                        <>
                          <View style={styles.divisor} />
                          <Text style={styles.resumoTotal}>= R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
                        </>
                      ) : (
                        <>
                          <View style={styles.divisor} />
                          <Text style={styles.resumoTotal}>Total: R$ {totalValorSemana.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
                        </>
                      )}
                    </Card.Content>
                  </Card>
                </View>
              );
            })}

            {abaAtiva === 'monthly' && dadosFiltrados.map((func) => {
              const pontos = func.pontos || [];
              
              // Agrupar pontos por semana
              const pontosPorSemana = {};
              pontos.forEach((ponto) => {
                const pontoDate = parseISODate(ponto.date);
                const weekRange = obterRangeSemana(ponto.date);
                const weekKey = `${weekRange.dataInicio.getFullYear()}-${weekRange.dataInicio.getMonth()}-${weekRange.dataInicio.getDate()}`;
                
                if (!pontosPorSemana[weekKey]) {
                  pontosPorSemana[weekKey] = {
                    weekStart: weekRange.dataInicio.toISOString().split('T')[0],
                    pontos: []
                  };
                }
                pontosPorSemana[weekKey].pontos.push(ponto);
              });

              let valorBaseTotalMes = 0;
              let bonificacaoTotalMes = 0;
              let totalHorasMes = 0;
              let quantidadeBonificacoes = 0;

              // Calcular valor e bonificação de cada semana
              const semanas = Object.values(pontosPorSemana);
              semanas.forEach((semana) => {
                let totalHorasSemana = 0;
                let totalValorSemana = 0;

                semana.pontos.forEach((ponto) => {
                  const entry = ponto.entry ? ponto.entry.split('T')[1].slice(0, 5) : '';
                  const exit = ponto.exit ? ponto.exit.split('T')[1].slice(0, 5) : '';
                  const valorDia = calcularValorDiario(entry, exit, func.valorHora);
                  totalValorSemana += valorDia;

                  const workedHours = calcularHorasTrabalhadas(entry, exit);
                  const match = workedHours.match(/(\d+)h\s+(\d+)m/);
                  if (match) {
                    totalHorasSemana += parseInt(match[1]) + (parseInt(match[2]) / 60);
                  }
                });

                // Buscar meta desta semana específica
                const metaHoras = func.metaHoras || 40;
                const bonificacao = func.bonificacao || 0;
                const { bonificacaoGanha, temBonificacao } = calcularBonus(
                  totalHorasSemana,
                  metaHoras,
                  bonificacao,
                  func.metasExtras
                );

                valorBaseTotalMes += totalValorSemana;
                if (temBonificacao) {
                  bonificacaoTotalMes += bonificacaoGanha;
                  quantidadeBonificacoes++;
                }
                totalHorasMes += totalHorasSemana;
              });

              const descontoValeMesTotal = descontoValeMes || 0;
              const valorTotalMes = valorBaseTotalMes + bonificacaoTotalMes - descontoValeMesTotal;

              return (
                <View key={func.id}>
                  {pontos.map((ponto) => {
                    const entry = ponto.entry ? ponto.entry.split('T')[1].slice(0, 5) : '';
                    const exit = ponto.exit ? ponto.exit.split('T')[1].slice(0, 5) : '';
                    const workedHours = calcularHorasTrabalhadas(entry, exit);
                    const valorDia = calcularValorDiario(entry, exit, func.valorHora);

                    return (
                      <Card key={ponto.date} style={styles.pontoCard}>
                        <Card.Content>
                          <Text style={styles.pontoData}>{formatarDataComSemana(ponto.date)}</Text>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoText}>Entrada: {entry || '--:--'}</Text>
                            <Text style={styles.infoText}>Saída: {exit || '--:--'}</Text>
                          </View>
                          <View style={styles.infoRow}>
                            <Text style={styles.infoText}>Horas: {workedHours}</Text>
                            <Text style={styles.infoText}>Valor: R$ {valorDia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
                          </View>
                        </Card.Content>
                      </Card>
                    );
                  })}
                  
                  <Card style={styles.resumoCard}>
                    <Card.Content>
                      <Text style={styles.resumoLabel}>Resumo do Mês:</Text>
                      <Text style={styles.resumoHoras}>{Math.floor(totalHorasMes)}h {Math.round((totalHorasMes % 1) * 60)}m</Text>
                      <Text style={styles.resumoValor}>R$ {valorBaseTotalMes.toFixed(2)}</Text>
                      {bonificacaoTotalMes > 0 && (
                        <Text style={styles.bonusValor}>+ R$ {bonificacaoTotalMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} 🏆 ({quantidadeBonificacoes}x)</Text>
                      )}
                      {descontoValeMesTotal > 0 && (
                        <Text style={styles.descontoValor}>- R$ {descontoValeMesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} 💵</Text>
                      )}
                      {descontoValeMesTotal > 0 && (
                        <>
                          <Text style={styles.gastoResumoTexto}>Gastos Bar a descontar no mês</Text>
                          <Button
                            mode="outlined"
                            compact
                            icon="format-list-bulleted"
                            onPress={() => abrirGastosDetalhes(rangeMes, `Gastos do mês — ${func.name}`)}
                            style={styles.gastoDetalheBtn}
                            textColor="#ff6b6b"
                          >
                            Ver gastos detalhados
                          </Button>
                        </>
                      )}
                      {(bonificacaoTotalMes > 0 || descontoValeMesTotal > 0) ? (
                        <>
                          <View style={styles.divisor} />
                          <Text style={styles.resumoTotal}>= R$ {valorTotalMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
                        </>
                      ) : (
                        <>
                          <View style={styles.divisor} />
                          <Text style={styles.resumoTotal}>Total: R$ {valorBaseTotalMes.toFixed(2)}</Text>
                        </>
                      )}
                    </Card.Content>
                  </Card>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Portal>
        <Modal
          visible={modalMetaSemanal}
          onDismiss={() => setModalMetaSemanal(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Definir Meta para Semana Específica</Text>
          
          {metaSemanalFuncionario && (
            <View style={styles.modalInfo}>
              <Text style={styles.modalInfoText}>Funcionário: {metaSemanalFuncionario.name}</Text>
              <Text style={styles.modalInfoText}>
                Período: {semanaParaMeta ? (() => {
                  const weekRange = obterRangeSemana(semanaParaMeta);
                  return `${weekRange.dataInicio.toLocaleDateString('pt-BR')} - ${weekRange.dataFim.toLocaleDateString('pt-BR')}`;
                })() : 'N/A'}
              </Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Meta de Horas (Semana):</Text>
            <TextInput
              style={styles.modalInput}
              value={metaSemanalValores.metaHoras}
              onChangeText={(text) => setMetaSemanalValores(prev => ({ ...prev, metaHoras: text }))}
              placeholder="Ex: 30"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Bonificação (R$):</Text>
            <TextInput
              style={styles.modalInput}
              value={metaSemanalValores.bonificacao}
              onChangeText={(text) => setMetaSemanalValores(prev => ({ ...prev, bonificacao: text }))}
              placeholder="Ex: 120.00"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Valor por Hora (R$):</Text>
            <TextInput
              style={styles.modalInput}
              value={metaSemanalValores.valorHora}
              onChangeText={(text) => setMetaSemanalValores(prev => ({ ...prev, valorHora: text }))}
              placeholder="Ex: 12.00"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Metas adicionais de bônus:</Text>
            {(metaSemanalValores.metasExtras || []).map((tier, idx) => (
              <View key={idx} style={styles.tierRow}>
                <Text style={styles.tierIndex}>#{idx + 2}</Text>
                <TextInput
                  style={styles.tierInput}
                  value={tier.metaHoras?.toString() ?? ''}
                  onChangeText={(text) => {
                    const updated = [...(metaSemanalValores.metasExtras || [])];
                    updated[idx] = { ...updated[idx], metaHoras: text };
                    setMetaSemanalValores(prev => ({ ...prev, metasExtras: updated }));
                  }}
                  placeholder="Horas"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                />
                <Text style={styles.tierArrow}>h →</Text>
                <TextInput
                  style={styles.tierInput}
                  value={tier.bonificacao?.toString() ?? ''}
                  onChangeText={(text) => {
                    const updated = [...(metaSemanalValores.metasExtras || [])];
                    updated[idx] = { ...updated[idx], bonificacao: text };
                    setMetaSemanalValores(prev => ({ ...prev, metasExtras: updated }));
                  }}
                  placeholder="Bônus R$"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                />
                <Button
                  mode="contained"
                  compact
                  onPress={() => {
                    const updated = (metaSemanalValores.metasExtras || []).filter((_, i) => i !== idx);
                    setMetaSemanalValores(prev => ({ ...prev, metasExtras: updated }));
                  }}
                  style={styles.tierRemove}
                  labelStyle={{ fontSize: 12 }}
                >
                  ✕
                </Button>
              </View>
            ))}
            {(metaSemanalValores.metasExtras || []).length < 3 && (
              <Button
                mode="outlined"
                onPress={() => setMetaSemanalValores(prev => ({
                  ...prev,
                  metasExtras: [...(prev.metasExtras || []), { metaHoras: '', bonificacao: '' }]
                }))}
                style={styles.tierAdd}
                textColor="#2196F3"
              >
                + Adicionar meta
              </Button>
            )}
          </View>

          <View style={styles.modalButtons}>
            <Button
              mode="contained"
              onPress={salvarMetaSemanal}
              style={styles.modalButton}
            >
              Salvar
            </Button>
            <Button
              mode="outlined"
              onPress={() => setModalMetaSemanal(false)}
              style={styles.modalButton}
              textColor="#fff"
            >
              Cancelar
            </Button>
          </View>
        </Modal>

        {/* Modal: detalhamento dos Gastos Bar */}
        <Modal
          visible={gastosModalVisible}
          onDismiss={() => setGastosModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>{gastosModalTitulo || 'Gastos Bar'}</Text>
          {gastosModalLoading ? (
            <ActivityIndicator size="large" color="#2196F3" style={{ margin: 20 }} />
          ) : (
            <>
              <View style={styles.gastoResumoBox}>
                <View style={styles.gastoResumoLinha}>
                  <Text style={styles.gastoResumoLabel}>Produtos (vale):</Text>
                  <Text style={styles.gastoResumoValor}>
                    R$ {Number(gastosModalData?.totalProdutos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.gastoResumoLinha}>
                  <Text style={styles.gastoResumoLabel}>Vales em dinheiro:</Text>
                  <Text style={styles.gastoResumoValor}>
                    R$ {Number(gastosModalData?.totalVales || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.divisor} />
                <View style={styles.gastoResumoLinha}>
                  <Text style={styles.gastoResumoTotalLabel}>Total a descontar:</Text>
                  <Text style={styles.gastoResumoTotalValor}>
                    R$ {Number(gastosModalData?.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>

              <ScrollView style={styles.gastoItensLista}>
                {(gastosModalData?.itens || []).length === 0 ? (
                  <Text style={styles.gastoVazio}>Nenhum gasto no período.</Text>
                ) : (
                  (gastosModalData?.itens || []).map((item, idx) => (
                    <View key={item.id || idx} style={styles.gastoItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.gastoItemDesc}>
                          {item.tipo === 'VALE' ? '💵 ' : '🛒 '}
                          {item.descricao || (item.tipo === 'VALE' ? 'Vale em dinheiro' : 'Produto')}
                        </Text>
                        <Text style={styles.gastoItemData}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : ''}
                          {item.quantidade ? ` · ${item.quantidade}x` : ''}
                        </Text>
                      </View>
                      <Text style={styles.gastoItemValor}>
                        R$ {Number(item.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>

              <Button
                mode="outlined"
                onPress={() => setGastosModalVisible(false)}
                textColor="#fff"
                style={{ marginTop: 12 }}
              >
                Fechar
              </Button>
            </>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    backgroundColor: '#1a1a1a',
  },
  headerTitle: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#1a1a1a',
    marginBottom: 16,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  selectButton: {
    borderColor: '#2196F3',
  },
  gerarButton: {
    backgroundColor: '#4caf50',
    marginBottom: 16,
  },
  navegacaoData: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navButton: {
    backgroundColor: '#2196F3',
  },
  dataText: {
    color: '#fff',
    fontSize: 16,
  },
  abasContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  abaButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  semanasScroll: {
    marginBottom: 16,
    maxHeight: 50,
  },
  semanaButton: {
    marginRight: 8,
  },
  semanaButtonActive: {
    backgroundColor: '#2196F3',
  },
  metaCard: {
    backgroundColor: '#2196F3',
    marginBottom: 16,
  },
  metaTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  metaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaText: {
    color: '#fff',
    fontSize: 12,
  },
  metaBadge: {
    color: '#fff',
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  defineMetaButton: {
    backgroundColor: '#ff9800',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
  },
  tabelaScroll: {
    flex: 1,
  },
  pontoCard: {
    backgroundColor: '#1a1a1a',
    marginBottom: 8,
  },
  pontoData: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  inputGroup: {
    flex: 1,
    marginHorizontal: 4,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 4,
  },
  timeInput: {
    backgroundColor: '#333',
    color: '#fff',
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#555',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoText: {
    color: '#aaa',
    fontSize: 12,
  },
  atualizarButton: {
    backgroundColor: '#2196F3',
    marginTop: 8,
  },
  resumoCard: {
    backgroundColor: '#4caf50',
    marginBottom: 16,
    marginTop: 8,
  },
  resumoLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resumoHoras: {
    color: '#fff',
    fontSize: 16,
    marginTop: 4,
  },
  resumoValor: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  bonusValor: {
    color: '#ffeb3b',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  descontoValor: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  gastoResumoTexto: {
    color: '#ff6b6b',
    fontSize: 12,
    marginTop: 2,
  },
  gastoDetalheBtn: {
    borderColor: '#ff6b6b',
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  gastoResumoBox: {
    backgroundColor: '#262626',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  gastoResumoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  gastoResumoLabel: {
    color: '#bbb',
  },
  gastoResumoValor: {
    color: '#fff',
  },
  gastoResumoTotalLabel: {
    color: '#fff',
    fontWeight: 'bold',
  },
  gastoResumoTotalValor: {
    color: '#ff6b6b',
    fontWeight: 'bold',
    fontSize: 16,
  },
  gastoItensLista: {
    maxHeight: 260,
  },
  gastoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  gastoItemDesc: {
    color: '#fff',
    fontSize: 14,
  },
  gastoItemData: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  gastoItemValor: {
    color: '#ff6b6b',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  gastoVazio: {
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 16,
  },
  divisor: {
    height: 1,
    backgroundColor: '#fff',
    marginVertical: 8,
  },
  resumoTotal: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    padding: 24,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    color: '#2196F3',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInfo: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
  },
  modalInfoText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  inputContainer: {
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#333',
    color: '#fff',
    padding: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#555',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  tierIndex: {
    color: '#aaa',
    fontSize: 12,
    width: 24,
  },
  tierInput: {
    backgroundColor: '#333',
    color: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#555',
    flex: 1,
    marginHorizontal: 2,
  },
  tierArrow: {
    color: '#fff',
    fontSize: 12,
    marginHorizontal: 2,
  },
  tierRemove: {
    backgroundColor: '#f44336',
    marginLeft: 4,
    minWidth: 0,
  },
  tierAdd: {
    borderColor: '#2196F3',
    marginTop: 10,
    alignSelf: 'flex-start',
  },
});