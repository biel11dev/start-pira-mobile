import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  Appbar,
  Card,
  TextInput,
  Button,
  Text,
  SegmentedButtons,
  IconButton,
} from 'react-native-paper';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatarValor } from '../utils/format';

export default function CashRegisterScreen({ navigation }) {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [valorCartao, setValorCartao] = useState('');
  const [valorDinheiro, setValorDinheiro] = useState('');
  const [semanaAtual, setSemanaAtual] = useState(1);
  const [mesAtual, setMesAtual] = useState(new Date().getMonth());
  const [anoAtual, setAnoAtual] = useState(new Date().getFullYear());
  const [valoresEditaveis, setValoresEditaveis] = useState({});
  const [abaAtiva, setAbaAtiva] = useState('weekly'); // 'weekly' ou 'monthly'
  const [valorMaquinaSemana, setValorMaquinaSemana] = useState({});

  // Vale / Sangria
  const { user } = useAuth();
  const [valeValor, setValeValor] = useState('');
  const [valeObs, setValeObs] = useState('');
  const [valeOrigens, setValeOrigens] = useState([{ nome: '', valor: '' }]);
  const [savingVale, setSavingVale] = useState(false);

  useEffect(() => {
    carregarRegistros();
    carregarValoresMaquina();
  }, [semanaAtual, mesAtual, anoAtual]);

  const carregarRegistros = async () => {
    try {
      const response = await api.get('/api/balances');
      const todosRegistros = response.data || [];
      
      // Filtrar registros da semana atual
      const registrosFiltrados = filtrarPorSemana(todosRegistros);
      setRegistros(registrosFiltrados);
      
      // Inicializar valores editáveis com os valores FINAIS
      const valores = {};
      registrosFiltrados.forEach(r => {
        valores[r.id] = {
          dinheiro: r.dinheirofimcaixa !== undefined && r.dinheirofimcaixa !== null ? r.dinheirofimcaixa.toString() : '',
          cartao: r.cartaofimcaixa !== undefined && r.cartaofimcaixa !== null ? r.cartaofimcaixa.toString() : ''
        };
      });
      setValoresEditaveis(valores);
    } catch (error) {
      console.error('Erro ao carregar registros:', error);
    }
  };

  const carregarValoresMaquina = async () => {
    try {
      const semanas = getSemanasDoMes(anoAtual, mesAtual);
      const novosValores = {};
      
      // Carregar valores de todas as semanas do mês
      for (let i = 0; i < semanas.length; i++) {
        try {
          const response = await api.get(`/api/machine-week-value?year=${anoAtual}&month=${mesAtual + 1}&week=${i + 1}`);
          novosValores[i] = response.data[0]?.value || 0;
          console.log(`✅ [CAIXA] Valor da máquina carregado para semana ${i + 1}: R$ ${novosValores[i]}`);
        } catch (err) {
          novosValores[i] = 0;
        }
      }
      
      setValorMaquinaSemana(novosValores);
    } catch (error) {
      console.error('Erro ao carregar valores da máquina:', error);
      // Em caso de erro, inicializar com zeros
      const valoresPorSemana = {};
      const semanas = getSemanasDoMes(anoAtual, mesAtual);
      semanas.forEach((_, index) => {
        valoresPorSemana[index] = 0;
      });
      setValorMaquinaSemana(valoresPorSemana);
    }
  };

  const filtrarPorSemana = (registros) => {
    const semanas = getSemanasDoMes(anoAtual, mesAtual);
    if (!semanas[semanaAtual - 1]) return [];
    
    const { inicio, fim } = semanas[semanaAtual - 1];
    
    return registros.filter(r => {
      // Parse correto da data sem problema de timezone
      const [ano, mes, dia] = r.date.split('T')[0].split('-');
      const dataRegistro = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
      dataRegistro.setHours(0, 0, 0, 0);
      
      const inicioComparar = new Date(inicio);
      inicioComparar.setHours(0, 0, 0, 0);
      
      const fimComparar = new Date(fim);
      fimComparar.setHours(0, 0, 0, 0);
      
      return dataRegistro >= inicioComparar && dataRegistro <= fimComparar;
    });
  };

  const getSemanasDoMes = (ano, mes) => {
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const semanas = [];
    
    // Primeira semana: do dia 1 até o primeiro domingo OU fim do mês
    let primeiroFimSemana = new Date(primeiroDia);
    while (primeiroFimSemana.getDay() !== 0 && primeiroFimSemana < ultimoDia) {
      primeiroFimSemana.setDate(primeiroFimSemana.getDate() + 1);
    }
    if (primeiroFimSemana > ultimoDia) {
      primeiroFimSemana = new Date(ultimoDia);
    }
    
    semanas.push({
      inicio: new Date(primeiroDia),
      fim: new Date(primeiroFimSemana)
    });
    
    // Próximas semanas: sempre de terça a domingo (ignora segunda-feira)
    let proximoInicio = new Date(primeiroFimSemana);
    proximoInicio.setDate(proximoInicio.getDate() + 1);
    
    while (proximoInicio <= ultimoDia) {
      let inicioSemana = new Date(proximoInicio);
      
      // Garante que o início é terça-feira (dia 2)
      while (inicioSemana.getDay() !== 2 && inicioSemana <= ultimoDia) {
        inicioSemana.setDate(inicioSemana.getDate() + 1);
      }
      
      if (inicioSemana > ultimoDia) break;
      
      // Fim da semana é domingo (6 dias depois da terça)
      let fimSemana = new Date(inicioSemana);
      fimSemana.setDate(fimSemana.getDate() + 5); // Terça + 5 dias = Domingo
      
      if (fimSemana > ultimoDia) {
        fimSemana = new Date(ultimoDia);
      }
      
      semanas.push({
        inicio: new Date(inicioSemana),
        fim: new Date(fimSemana)
      });
      
      proximoInicio = new Date(fimSemana);
      proximoInicio.setDate(proximoInicio.getDate() + 1);
    }
    
    return semanas;
  };

  const registrarCaixa = async () => {
    if (!valorCartao && !valorDinheiro) {
      Alert.alert('Atenção', 'Preencha ao menos um valor');
      return;
    }

    setLoading(true);
    try {
      const cartao = parseFloat(valorCartao) || 0;
      const dinheiro = parseFloat(valorDinheiro) || 0;
      
      await api.post('/api/balances', {
        date: dataSelecionada.toISOString(),
        balance: cartao + dinheiro,
        cartao: cartao,
        dinheiro: dinheiro,
      });

      Alert.alert('Sucesso', 'Registro de caixa salvo!');
      setValorCartao('');
      setValorDinheiro('');
      carregarRegistros();
    } catch (error) {
      Alert.alert('Erro', 'Erro ao registrar caixa');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // --- Vale / Sangria ---
  const addOrigemVale = () => setValeOrigens((prev) => [...prev, { nome: '', valor: '' }]);
  const removeOrigemVale = (index) =>
    setValeOrigens((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  const changeOrigemVale = (index, campo, valor) =>
    setValeOrigens((prev) => prev.map((o, i) => (i === index ? { ...o, [campo]: valor } : o)));

  const registrarVale = async () => {
    const valor = parseFloat(valeValor);
    if (!valor || valor <= 0) {
      Alert.alert('Atenção', 'Informe o valor do vale');
      return;
    }

    const origensPreenchidas = valeOrigens.filter((o) => o.nome && parseFloat(o.valor) > 0);
    if (origensPreenchidas.length > 0) {
      const soma = origensPreenchidas.reduce((s, o) => s + parseFloat(o.valor), 0);
      if (Math.abs(soma - valor) > 0.01) {
        Alert.alert(
          'Atenção',
          `A soma dos destinos (R$ ${formatarValor(soma)}) deve ser igual ao valor total (R$ ${formatarValor(valor)})`
        );
        return;
      }
    }

    setSavingVale(true);
    try {
      const resp = await api.post('/api/pdv-caixa-vale', {
        valor,
        origens: origensPreenchidas.map((o) => ({ nome: o.nome, valor: parseFloat(o.valor) })),
        observacao: valeObs || null,
      });

      let msg = 'Vale registrado com sucesso!';
      if (resp.data?.isAdmin && resp.data?.despesaPessoal) {
        msg += ' Despesa criada no módulo Pessoal.';
      }
      if (resp.data?.isFuncionario && resp.data?.gastoBar) {
        msg += ' Lançado em Gastos Bar — será descontado do total da semana no Ponto.';
      }
      Alert.alert('Sucesso', msg);
      setValeValor('');
      setValeObs('');
      setValeOrigens([{ nome: '', valor: '' }]);
    } catch (error) {
      console.error('Erro ao registrar vale:', error);
      Alert.alert('Erro', 'Erro ao registrar vale');
    } finally {
      setSavingVale(false);
    }
  };

  const atualizarRegistro = async (id, cartao, dinheiro) => {
    try {
      const cartaoFinal = parseFloat(cartao) || 0;
      const dinheiroFinal = parseFloat(dinheiro) || 0;
      const balancefim = cartaoFinal + dinheiroFinal;
      
      // Buscar o registro original para pegar o balance (saldo inicial)
      const registroOriginal = registros.find(r => r.id === id);
      const lucro = balancefim - (registroOriginal?.balance || 0);
      
      await api.put(`/api/balances/${id}`, {
        cartaofimcaixa: cartaoFinal,
        dinheirofimcaixa: dinheiroFinal,
        balancefim: balancefim,
        lucro: lucro
      });
      Alert.alert('Sucesso', 'Registro atualizado!');
      carregarRegistros();
    } catch (error) {
      const msg = error.response?.status === 409
        ? (error.response?.data?.error || 'Este registro está vinculado a um caixa fechado.')
        : 'Erro ao atualizar registro';
      Alert.alert('Erro', msg);
    }
  };

  const atualizarValorEditavel = (id, campo, valor) => {
    setValoresEditaveis(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [campo]: valor
      }
    }));
  };

  const excluirRegistro = async (id) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Deseja realmente excluir este registro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/balances/${id}`);
              Alert.alert('Sucesso', 'Registro excluído!');
              carregarRegistros();
            } catch (error) {
              const msg = error.response?.status === 409
                ? (error.response?.data?.error || 'Este registro está vinculado a um caixa fechado.')
                : 'Erro ao excluir registro';
              Alert.alert('Erro', msg);
            }
          }
        }
      ]
    );
  };

  const salvarValorMaquina = async () => {
    try {
      const valorAtual = parseFloat(valorMaquinaSemana[semanaAtual - 1]) || 0;
      
      await api.post('/api/machine-week-value', {
        year: anoAtual,
        month: mesAtual + 1,
        week: semanaAtual,
        value: valorAtual
      });

      Alert.alert('Sucesso', 'Valor da máquina salvo!');
      carregarValoresMaquina();
    } catch (error) {
      console.error('Erro ao salvar valor da máquina:', error);
      Alert.alert('Erro', 'Erro ao salvar valor da máquina');
    }
  };

  const calcularLucroTotal = () => {
    const totalLucro = registros.reduce((acc, r) => acc + (r.lucro || 0), 0);
    const maquina = parseFloat(valorMaquinaSemana[semanaAtual - 1]) || 0;
    return totalLucro + maquina;
  };

  const mudarData = (dias) => {
    const novaData = new Date(dataSelecionada);
    novaData.setDate(novaData.getDate() + dias);
    setDataSelecionada(novaData);
  };

  const mudarMes = (direcao) => {
    let novoMes = mesAtual + direcao;
    let novoAno = anoAtual;
    
    if (novoMes > 11) {
      novoMes = 0;
      novoAno++;
    } else if (novoMes < 0) {
      novoMes = 11;
      novoAno--;
    }
    
    setMesAtual(novoMes);
    setAnoAtual(novoAno);
    setSemanaAtual(1);
  };

  const formatarData = (data) => {
    // Parse correto da data sem problema de timezone
    const [ano, mes, dia] = data.split('T')[0].split('-');
    const date = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  };

  const getNomeMes = () => {
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${meses[mesAtual]} ${anoAtual}`;
  };

  const calcularDadosMensais = () => {
    const semanas = getSemanasDoMes(anoAtual, mesAtual);
    
    return semanas.map((semana, index) => {
      const registrosSemana = registros.filter(r => {
        // Parse correto da data sem problema de timezone
        const [ano, mes, dia] = r.date.split('T')[0].split('-');
        const dataRegistro = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
        dataRegistro.setHours(0, 0, 0, 0);
        
        const inicioComparar = new Date(semana.inicio);
        inicioComparar.setHours(0, 0, 0, 0);
        
        const fimComparar = new Date(semana.fim);
        fimComparar.setHours(0, 0, 0, 0);
        
        return dataRegistro >= inicioComparar && dataRegistro <= fimComparar;
      });
      
      const totalSaldoInicial = registrosSemana.reduce((acc, r) => acc + (r.balance || 0), 0);
      const totalLucro = registrosSemana.reduce((acc, r) => acc + (r.lucro || 0), 0);
      const totalSaldoFinal = registrosSemana.reduce((acc, r) => {
        const saldoFinal = (r.cartaofimcaixa || 0) + (r.dinheirofimcaixa || 0);
        return acc + saldoFinal;
      }, 0);
      const valorMaquina = valorMaquinaSemana[index] || 0;
      
      return {
        semana: `Semana ${index + 1} (${semana.inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - ${semana.fim.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`,
        registros: registrosSemana,
        totalSaldoInicial,
        totalLucro,
        totalSaldoFinal,
        valorMaquina,
        temRegistros: registrosSemana.length > 0
      };
    });
  };

  const dadosMensais = calcularDadosMensais();
  const totalLucroMes = dadosMensais.reduce((acc, semana) => acc + semana.totalLucro, 0);
  const totalValorMaquinaMes = Object.values(valorMaquinaSemana).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);


  const semanas = getSemanasDoMes(anoAtual, mesAtual);

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
        <Appbar.Content title="Registro de Caixa" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* Formulário de Registro */}
        <Card style={styles.formCard}>
          <Card.Title title="Novo Registro" titleStyle={styles.cardTitle} />
          <Card.Content>
            <TextInput
              label="Valor em Cartão"
              value={valorCartao}
              onChangeText={setValorCartao}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              theme={{ colors: { background: '#1a1a1a' } }}
            />

            <TextInput
              label="Valor em Dinheiro"
              value={valorDinheiro}
              onChangeText={setValorDinheiro}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              theme={{ colors: { background: '#1a1a1a' } }}
            />

            {/* Navegação de Data */}
            <View style={styles.dateNav}>
              <Button
                mode="contained"
                onPress={() => mudarData(-30)}
                style={styles.dateButton}
                compact
              >
                &lt;&lt; Mês
              </Button>
              <Button
                mode="contained"
                onPress={() => mudarData(-1)}
                style={styles.dateButton}
                compact
              >
                &lt; Dia
              </Button>
              <Text style={styles.dateText}>
                {dataSelecionada.toLocaleDateString('pt-BR')}
              </Text>
              <Button
                mode="contained"
                onPress={() => mudarData(1)}
                style={styles.dateButton}
                compact
              >
                Dia &gt;
              </Button>
              <Button
                mode="contained"
                onPress={() => mudarData(30)}
                style={styles.dateButton}
                compact
              >
                Mês &gt;&gt;
              </Button>
            </View>

            <Button
              mode="contained"
              onPress={registrarCaixa}
              loading={loading}
              disabled={loading}
              style={styles.submitButton}
            >
              Confirmar
            </Button>
          </Card.Content>
        </Card>

        {/* Registrar Vale / Sangria */}
        <Card style={styles.formCard}>
          <Card.Title
            title="Registrar Vale / Sangria"
            subtitle="Adiantamento em dinheiro"
            titleStyle={styles.cardTitle}
            subtitleStyle={styles.cardSubtitle}
          />
          <Card.Content>
            <TextInput
              label="Valor do Vale (R$)"
              value={valeValor}
              onChangeText={setValeValor}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              theme={{ colors: { background: '#1a1a1a' } }}
            />

            <Text style={styles.valeHint}>Destinos (opcional):</Text>
            {valeOrigens.map((origem, index) => (
              <View key={index} style={styles.valeOrigemRow}>
                <TextInput
                  label="Nome"
                  value={origem.nome}
                  onChangeText={(t) => changeOrigemVale(index, 'nome', t)}
                  mode="outlined"
                  style={styles.valeOrigemNome}
                  theme={{ colors: { background: '#1a1a1a' } }}
                />
                <TextInput
                  label="Valor"
                  value={origem.valor}
                  onChangeText={(t) => changeOrigemVale(index, 'valor', t)}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  style={styles.valeOrigemValor}
                  theme={{ colors: { background: '#1a1a1a' } }}
                />
                <IconButton
                  icon="close"
                  size={20}
                  iconColor="#F44336"
                  onPress={() => removeOrigemVale(index)}
                  disabled={valeOrigens.length <= 1}
                />
              </View>
            ))}
            <Button mode="text" icon="plus" onPress={addOrigemVale} compact>
              Adicionar destino
            </Button>

            <TextInput
              label="Observação (opcional)"
              value={valeObs}
              onChangeText={setValeObs}
              mode="outlined"
              style={styles.input}
              theme={{ colors: { background: '#1a1a1a' } }}
            />

            <Button
              mode="contained"
              icon="cash-minus"
              onPress={registrarVale}
              loading={savingVale}
              disabled={savingVale}
              style={styles.valeButton}
            >
              Registrar Vale
            </Button>
          </Card.Content>
        </Card>

        {/* Navegação de Mês */}
        <View style={styles.monthNav}>
          <Button
            mode="contained"
            onPress={() => mudarMes(-1)}
            style={styles.monthButton}
          >
            Mês Anterior
          </Button>
          <Text style={styles.monthText}>{getNomeMes()}</Text>
          <Button
            mode="contained"
            onPress={() => mudarMes(1)}
            style={styles.monthButton}
          >
            Próximo Mês
          </Button>
        </View>

        {/* Abas Semanal/Mensal */}
        <View style={styles.tabsContainer}>
          <Button
            mode={abaAtiva === 'weekly' ? 'contained' : 'outlined'}
            onPress={() => setAbaAtiva('weekly')}
            style={styles.tabButton}
            textColor={abaAtiva === 'weekly' ? '#fff' : '#2196F3'}
          >
            Saldo Semanal
          </Button>
          <Button
            mode={abaAtiva === 'monthly' ? 'contained' : 'outlined'}
            onPress={() => setAbaAtiva('monthly')}
            style={styles.tabButton}
            textColor={abaAtiva === 'monthly' ? '#fff' : '#2196F3'}
          >
            Saldo Mensal
          </Button>
        </View>

        {/* Visualização Semanal */}
        {abaAtiva === 'weekly' && (
          <>
            {/* Seleção de Semana */}
            <Card style={styles.weekCard}>
              <Card.Content>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.weekButtons}>
                    {semanas.map((semana, index) => {
                      const inicio = semana.inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                      const fim = semana.fim.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                      return (
                        <Button
                          key={index}
                          mode={semanaAtual === index + 1 ? 'contained' : 'outlined'}
                          onPress={() => setSemanaAtual(index + 1)}
                          style={styles.weekButton}
                          compact
                        >
                          Semana {index + 1} ({inicio} - {fim})
                        </Button>
                      );
                    })}
                  </View>
                </ScrollView>
              </Card.Content>
            </Card>

            {/* Lista de Registros da Semana */}
            <Card style={styles.registrosCard}>
              <Card.Title title="Registros da Semana" titleStyle={styles.cardTitle} />
              <Card.Content>
                {registros.length === 0 ? (
                  <Text style={styles.semRegistros}>Nenhum registro nesta semana</Text>
                ) : (
                  registros.map((registro) => (
                    <Card key={registro.id} style={styles.registroItem}>
                      <Card.Content>
                        <View style={styles.registroHeader}>
                          <Text style={styles.registroData}>{formatarData(registro.date)}</Text>
                          <Text style={styles.registroTotal}>
                            R$ {formatarValor(registro.balance || 0)}
                          </Text>
                        </View>
                        
                        <View style={styles.registroInputs}>
                          <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Valor Final Dinheiro</Text>
                            <TextInput
                              value={valoresEditaveis[registro.id]?.dinheiro || ''}
                              onChangeText={(valor) => atualizarValorEditavel(registro.id, 'dinheiro', valor)}
                              mode="outlined"
                              keyboardType="decimal-pad"
                              style={styles.smallInput}
                              dense
                              placeholder="0"
                              theme={{ colors: { background: '#2a2a2a' } }}
                            />
                          </View>
                          
                          <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Valor Final Cartão</Text>
                            <TextInput
                              value={valoresEditaveis[registro.id]?.cartao || ''}
                              onChangeText={(valor) => atualizarValorEditavel(registro.id, 'cartao', valor)}
                              mode="outlined"
                              keyboardType="decimal-pad"
                              style={styles.smallInput}
                              dense
                              placeholder="0"
                              theme={{ colors: { background: '#2a2a2a' } }}
                            />
                          </View>
                        </View>

                        {registro.lucro != null && (
                          <View style={styles.registroLucroRow}>
                            <Text style={styles.registroLucroLabel}>Lucro do dia:</Text>
                            <Text style={styles.registroLucroValor}>R$ {formatarValor(registro.lucro || 0)}</Text>
                          </View>
                        )}

                        <View style={styles.registroActions}>
                          <Button
                            mode="contained"
                            onPress={() => atualizarRegistro(
                              registro.id, 
                              valoresEditaveis[registro.id]?.cartao || '0', 
                              valoresEditaveis[registro.id]?.dinheiro || '0'
                            )}
                            style={styles.actionButton}
                            compact
                          >
                            Atualizar
                          </Button>
                          <Button
                            mode="contained"
                            onPress={() => excluirRegistro(registro.id)}
                            style={[styles.actionButton, styles.deleteButton]}
                            compact
                          >
                            Excluir
                          </Button>
                        </View>
                      </Card.Content>
                    </Card>
                  ))
                )}
              </Card.Content>
            </Card>

                        {/* Valor Máquina Semana */}
            <Card style={styles.maquinaCard}>
              <Card.Content>
                <Text style={styles.maquinaLabel}>Valor Máquina Semana:</Text>
                <View style={styles.maquinaInputContainer}>
                  <TextInput
                    value={valorMaquinaSemana[semanaAtual - 1]?.toString() || ''}
                    onChangeText={(valor) => {
                      setValorMaquinaSemana(prev => ({
                        ...prev,
                        [semanaAtual - 1]: parseFloat(valor) || 0
                      }));
                    }}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    placeholder="R$ 0,00"
                    style={styles.maquinaInput}
                    theme={{ colors: { background: '#2a2a2a' } }}
                  />
                  <Button
                    mode="contained"
                    onPress={salvarValorMaquina}
                    style={styles.maquinaSalvarButton}
                    icon="content-save"
                  >
                    Salvar
                  </Button>
                </View>
                <Text style={styles.maquinaTotal}>
                  Valor Total Máquina Semana: R$ {formatarValor(valorMaquinaSemana[semanaAtual - 1] || 0)}
                </Text>
              </Card.Content>
            </Card>

            {/* Lucro Total Semanal */}
            <Card style={styles.lucroCard}>
              <Card.Content>
                <Text style={styles.lucroLabel}>Lucro Total da Semana:</Text>
                <Text style={styles.lucroValor}>
                  R$ {formatarValor(calcularLucroTotal())}
                </Text>
              </Card.Content>
            </Card>


          </>
        )}

        {/* Visualização Mensal */}
        {abaAtiva === 'monthly' && (
          <>
            <Card style={styles.mensalCard}>
              <Card.Title title="Saldo Mensal" titleStyle={styles.cardTitle} />
              <Card.Content>
                {dadosMensais.map((dadosSemana, index) => (
                  <View key={index} style={styles.semanaContainer}>
                    <Text style={styles.semanaTitulo}>{dadosSemana.semana}</Text>
                    
                    {dadosSemana.temRegistros ? (
                      <>
                        {dadosSemana.registros.map((registro) => (
                          <View key={registro.id} style={styles.registroMensal}>
                            <Text style={styles.registroMensalData}>
                              {formatarData(registro.date)}:
                              <Text style={styles.registroMensalValor}>
                                R$ {formatarValor((registro.cartaofimcaixa || 0) + (registro.dinheirofimcaixa || 0))}
                              </Text>
                            </Text>
                            <View style={styles.registroMensalDetalhes}>
                              <Text style={styles.detalhesText}>
                                Valor Final Dinheiro: {registro.dinheirofimcaixa || 0}
                              </Text>
                              <Text style={styles.detalhesText}>
                                Valor Final Cartão: {registro.cartaofimcaixa || 0}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </>
                    ) : (
                      <Text style={styles.semRegistrosMensal}>Nenhum registro nesta semana</Text>
                    )}
                  </View>
                ))}

                {totalValorMaquinaMes > 0 && (
                  <View style={styles.valorMaquinaContainer}>
                    <Text style={styles.valorMaquinaLabel}>Valor Total Máquina Mês:</Text>
                    <Text style={styles.valorMaquinaValor}>R$ {formatarValor(totalValorMaquinaMes)}</Text>
                  </View>
                )}
              </Card.Content>
            </Card>

            {/* Lucro Total Mensal */}
            <Card style={styles.lucroMensalCard}>
              <Card.Content>
                <Text style={styles.lucroLabel}>Lucro Total do Mês:</Text>
                <Text style={styles.lucroValor}>
                  R$ {formatarValor(totalLucroMes)}
                </Text>
              </Card.Content>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
  formCard: {
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
  },
  cardTitle: {
    color: '#fff',
  },
  cardSubtitle: {
    color: '#aaa',
    fontSize: 12,
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#1a1a1a',
  },
  dateNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
    flexWrap: 'wrap',
  },
  dateButton: {
    minWidth: 70,
    marginHorizontal: 2,
    backgroundColor: '#2196F3',
  },
  dateText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginHorizontal: 8,
  },
  submitButton: {
    marginTop: 12,
    backgroundColor: '#2196F3',
    paddingVertical: 8,
  },
  valeHint: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 6,
  },
  valeOrigemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  valeOrigemNome: {
    flex: 2,
    marginRight: 6,
    backgroundColor: '#1a1a1a',
  },
  valeOrigemValor: {
    flex: 1,
    marginRight: 2,
    backgroundColor: '#1a1a1a',
  },
  valeButton: {
    marginTop: 12,
    backgroundColor: '#FF9800',
    paddingVertical: 8,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthButton: {
    backgroundColor: '#2196F3',
  },
  monthText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  tabButton: {
    flex: 1,
  },
  weekCard: {
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
  },
  weekButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  weekButton: {
    marginHorizontal: 4,
  },
  registrosCard: {
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
  },
  semRegistros: {
    textAlign: 'center',
    padding: 20,
    color: '#999',
  },
  registroItem: {
    marginBottom: 12,
    backgroundColor: '#2a2a2a',
  },
  registroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  registroData: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textTransform: 'capitalize',
  },
  registroTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  registroInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    color: '#aaa',
    marginBottom: 4,
  },
  smallInput: {
    backgroundColor: '#2a2a2a',
  },
  registroActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  registroLucroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  registroLucroLabel: {
    color: '#aaa',
    fontSize: 13,
  },
  registroLucroValor: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  lucroCard: {
    marginBottom: 16,
    backgroundColor: '#1B5E20',
  },
  lucroLabel: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  lucroValor: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
  },
  maquinaCard: {
    marginBottom: 16,
    backgroundColor: '#FF9800',
  },
  maquinaLabel: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: 12,
  },
  maquinaInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  maquinaInput: {
    flex: 1,
    backgroundColor: '#fff',
  },
  maquinaSalvarButton: {
    backgroundColor: '#1976D2',
  },
  maquinaTotal: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  mensalCard: {
    marginBottom: 16,
    backgroundColor: '#1a1a1a',
  },
  semanaContainer: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  semanaTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 8,
  },
  registroMensal: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  registroMensalData: {
    fontSize: 14,
    color: '#fff',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  registroMensalValor: {
    color: '#4CAF50',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  registroMensalDetalhes: {
    marginTop: 4,
  },
  detalhesText: {
    fontSize: 12,
    color: '#aaa',
  },
  semRegistrosMensal: {
    textAlign: 'center',
    padding: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  valorMaquinaContainer: {
    backgroundColor: '#FF9800',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  valorMaquinaLabel: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
  },
  valorMaquinaValor: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 4,
  },
  lucroMensalCard: {
    marginBottom: 16,
    backgroundColor: '#1B5E20',
  },
});
