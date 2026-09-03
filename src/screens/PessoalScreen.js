import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {
  Appbar,
  Card,
  TextInput,
  Button,
  Text,
  Chip,
  FAB,
  Portal,
  Modal,
  IconButton,
  Divider,
  Searchbar,
} from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import api from '../services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PessoalScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [despesas, setDespesas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalEditVisible, setModalEditVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandidas, setExpandidas] = useState({});
  const [busca, setBusca] = useState('');
  
  // Navegação de mês
  const [mesAtual, setMesAtual] = useState(new Date());

  // Form fields
  const [nomeDespesa, setNomeDespesa] = useState('');
  const [valorDespesa, setValorDespesa] = useState('');
  const [descDespesa, setDescDespesa] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [dataDespesa, setDataDespesa] = useState(new Date().toISOString().split('T')[0]);
  const [tipoMovimento, setTipoMovimento] = useState('GASTO');
  const [isVale, setIsVale] = useState('Não');
  const [despesaFixa, setDespesaFixa] = useState('Variável');

  // Filtros
  const [filtroAtivo, setFiltroAtivo] = useState('todos');

  // Edit
  const [despesaEditando, setDespesaEditando] = useState(null);

  // Gerenciamento de categorias
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [catEditandoId, setCatEditandoId] = useState(null);
  const [catEditNome, setCatEditNome] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  useEffect(() => {
    carregarDados();
  }, [mesAtual]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [despesasRes, categoriasRes] = await Promise.all([
        api.get('/api/desp-pessoal'),
        api.get('/api/cat-desp-pessoal'),
      ]);
      setDespesas(despesasRes.data || []);
      setCategorias(categoriasRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const adicionarDespesa = async () => {
    if (!valorDespesa) {
      Alert.alert('Atenção', 'Preencha o valor');
      return;
    }

    setSaving(true);
    try {
      const catId = categoriaId ? parseInt(categoriaId) : null;
      const valeMarcado = isVale === 'Sim';

      await api.post('/api/desp-pessoal', {
        nomeDespesa: nomeDespesa || 'Sem descrição',
        valorDespesa: parseFloat(valorDespesa),
        descDespesa: descDespesa || null,
        date: dataDespesa,
        DespesaFixa: despesaFixa === 'Fixa',
        categoriaId: catId,
        tipoMovimento,
        isVale: valeMarcado,
      });

      // Se for GASTO com VALE marcado, criar também um GANHO "VALE"
      if (tipoMovimento === 'GASTO' && valeMarcado) {
        try {
          await api.post('/api/desp-pessoal', {
            nomeDespesa: 'VALE',
            valorDespesa: parseFloat(valorDespesa),
            descDespesa: `Vale referente a: ${nomeDespesa || 'Sem descrição'}`,
            date: dataDespesa,
            DespesaFixa: false,
            categoriaId: catId,
            tipoMovimento: 'GANHO',
            isVale: true,
          });
        } catch (valeErr) {
          console.error('Erro ao adicionar VALE (GANHO):', valeErr);
        }
      }

      // Se for GASTO FIXO, criar entradas com valor 0 para os meses restantes do ano
      if (tipoMovimento === 'GASTO' && despesaFixa === 'Fixa') {
        const base = new Date(dataDespesa);
        const ano = base.getFullYear();
        const mesInicial = base.getMonth(); // 0-11
        for (let m = mesInicial + 1; m <= 11; m++) {
          const mm = String(m + 1).padStart(2, '0');
          const dateFutura = `${ano}-${mm}-02`;
          try {
            await api.post('/api/desp-pessoal', {
              nomeDespesa: nomeDespesa || 'Sem descrição',
              valorDespesa: 0,
              descDespesa: descDespesa || null,
              date: dateFutura,
              DespesaFixa: true,
              categoriaId: catId,
              tipoMovimento: 'GASTO',
            });
          } catch (fixErr) {
            console.error('Erro ao criar despesa fixa futura:', fixErr);
          }
        }
      }

      Alert.alert('Sucesso', valeMarcado ? 'Despesa e VALE adicionados!' : 'Despesa registrada!');
      setModalVisible(false);
      limparForm();
      carregarDados();
    } catch (error) {
      Alert.alert('Erro', 'Erro ao registrar despesa');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const editarDespesa = async () => {
    if (!valorDespesa) {
      Alert.alert('Atenção', 'Preencha o valor');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/api/desp-pessoal/${despesaEditando.id}`, {
        nomeDespesa: nomeDespesa || 'Sem descrição',
        valorDespesa: parseFloat(valorDespesa),
        descDespesa: descDespesa || null,
        date: dataDespesa,
        tipoMovimento,
        categoriaId: categoriaId ? parseInt(categoriaId) : null,
      });

      Alert.alert('Sucesso', 'Despesa atualizada!');
      setModalEditVisible(false);
      setDespesaEditando(null);
      limparForm();
      carregarDados();
    } catch (error) {
      Alert.alert('Erro', 'Erro ao atualizar despesa');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const excluirDespesa = async (id) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Deseja realmente excluir esta despesa?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/desp-pessoal/${id}`);
              Alert.alert('Sucesso', 'Despesa excluída!');
              carregarDados();
            } catch (error) {
              Alert.alert('Erro', 'Erro ao excluir despesa');
            }
          },
        },
      ]
    );
  };

  const abrirEdicao = (despesa) => {
    setDespesaEditando(despesa);
    setNomeDespesa(despesa.nomeDespesa || '');
    setValorDespesa(despesa.valorDespesa?.toString() || '');
    setDescDespesa(despesa.descDespesa || '');
    setTipoMovimento(despesa.tipoMovimento || 'GASTO');
    setCategoriaId(
      despesa.categoria?.id
        ? despesa.categoria.id.toString()
        : despesa.categoriaId
        ? despesa.categoriaId.toString()
        : ''
    );
    setDataDespesa(
      despesa.date ? new Date(despesa.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    );
    setModalEditVisible(true);
  };

  // ===== Gerenciamento de Categorias =====
  const adicionarCategoria = async () => {
    if (!novaCategoria.trim()) {
      Alert.alert('Atenção', 'Digite o nome da categoria');
      return;
    }
    setSavingCat(true);
    try {
      await api.post('/api/cat-desp-pessoal', { nomeCategoria: novaCategoria.trim() });
      setNovaCategoria('');
      await carregarDados();
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      Alert.alert('Erro', 'Não foi possível criar a categoria');
    } finally {
      setSavingCat(false);
    }
  };

  const salvarEdicaoCategoria = async () => {
    if (!catEditNome.trim()) {
      Alert.alert('Atenção', 'Digite o nome da categoria');
      return;
    }
    setSavingCat(true);
    try {
      await api.put(`/api/cat-desp-pessoal/${catEditandoId}`, { nomeCategoria: catEditNome.trim() });
      setCatEditandoId(null);
      setCatEditNome('');
      await carregarDados();
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a categoria');
    } finally {
      setSavingCat(false);
    }
  };

  const excluirCategoria = (cat) => {
    Alert.alert(
      'Confirmar Exclusão',
      `Deseja excluir a categoria "${cat.nomeCategoria}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/cat-desp-pessoal/${cat.id}`);
              await carregarDados();
            } catch (error) {
              console.error('Erro ao excluir categoria:', error);
              Alert.alert('Erro', 'Não foi possível excluir a categoria');
            }
          },
        },
      ]
    );
  };

  const limparForm = () => {
    setNomeDespesa('');
    setValorDespesa('');
    setDescDespesa('');
    setCategoriaId('');
    setDataDespesa(new Date().toISOString().split('T')[0]);
    setTipoMovimento('GASTO');
    setIsVale('Não');
    setDespesaFixa('Variável');
  };

  const mesAnterior = () => {
    const novaData = new Date(mesAtual);
    novaData.setMonth(novaData.getMonth() - 1);
    setMesAtual(novaData);
  };

  const proximoMes = () => {
    const novaData = new Date(mesAtual);
    novaData.setMonth(novaData.getMonth() + 1);
    setMesAtual(novaData);
  };

  const getNomeMes = () => {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${meses[mesAtual.getMonth()]} ${mesAtual.getFullYear()}`;
  };

  const despesasDoMes = despesas.filter(d => {
    if (!d.date) return false;
    const dataDespesa = new Date(d.date);
    return dataDespesa.getMonth() === mesAtual.getMonth() &&
           dataDespesa.getFullYear() === mesAtual.getFullYear();
  });

  const despesasFiltradas = despesasDoMes.filter(d => {
    const matchBusca = busca === '' || 
      d.nomeDespesa?.toLowerCase().includes(busca.toLowerCase()) ||
      d.descDespesa?.toLowerCase().includes(busca.toLowerCase());
    
    if (filtroAtivo === 'todos') return matchBusca;
    if (filtroAtivo === 'gastos-fixos') return matchBusca && d.tipoMovimento === 'GASTO' && d.DespesaFixa;
    if (filtroAtivo === 'gastos-variaveis') return matchBusca && d.tipoMovimento === 'GASTO' && !d.DespesaFixa;
    if (filtroAtivo === 'ganhos') return matchBusca && d.tipoMovimento === 'GANHO';
    return matchBusca;
  });

  const agruparPorCategoria = () => {
    const grupos = {};
    
    despesasFiltradas.forEach(despesa => {
      const categoria = despesa.nomeDespesa || 'Sem Categoria';
      
      if (!grupos[categoria]) {
        grupos[categoria] = {
          nome: categoria,
          despesas: [],
          total: 0,
          tipo: despesa.tipoMovimento,
        };
      }
      
      grupos[categoria].despesas.push(despesa);
      grupos[categoria].total += despesa.valorDespesa || 0;
    });
    
    return Object.values(grupos);
  };

  const toggleExpandir = (categoria) => {
    setExpandidas(prev => ({
      ...prev,
      [categoria]: !prev[categoria],
    }));
  };

  const calcularTotais = () => {
    const gastos = despesasDoMes
      .filter(d => d.tipoMovimento === 'GASTO')
      .reduce((acc, d) => acc + (d.valorDespesa || 0), 0);
    
    const ganhos = despesasDoMes
      .filter(d => d.tipoMovimento === 'GANHO')
      .reduce((acc, d) => acc + (d.valorDespesa || 0), 0);
    
    return { gastos, ganhos, saldo: ganhos - gastos };
  };

  const contarPorFiltro = () => {
    const todos = despesasDoMes.length;
    const gastosFixos = despesasDoMes.filter(d => d.tipoMovimento === 'GASTO' && d.DespesaFixa).length;
    const gastosVariaveis = despesasDoMes.filter(d => d.tipoMovimento === 'GASTO' && !d.DespesaFixa).length;
    const ganhos = despesasDoMes.filter(d => d.tipoMovimento === 'GANHO').length;
    
    return { todos, gastosFixos, gastosVariaveis, ganhos };
  };

  const formatarData = (data) => {
    if (!data) return 'Invalid Date';
    const date = new Date(data);
    return date.toLocaleDateString('pt-BR');
  };

  const formatarValor = (valor) => {
    const n = Number(valor);
    const safe = Number.isFinite(n) ? n : 0;
    const [inteiro, decimal] = Math.abs(safe).toFixed(2).split('.');
    const inteiroFmt = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${safe < 0 ? '-' : ''}${inteiroFmt},${decimal}`;
  };

  const totais = calcularTotais();
  const contadores = contarPorFiltro();

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
        <Appbar.Content title="Despesas Pessoais" titleStyle={styles.headerTitle} />
        <Appbar.Action icon="tag-multiple" color="#fff" onPress={() => setCatModalVisible(true)} />
      </Appbar.Header>

      <View style={styles.content}>
        {/* Navegação de Mês */}
        <View style={styles.mesNavegacao}>
          <Button
            mode="contained"
            onPress={mesAnterior}
            style={styles.mesButton}
            labelStyle={styles.mesButtonLabel}
          >
            Mês Anterior
          </Button>
          <Text style={styles.mesAtual}>{getNomeMes()}</Text>
          <Button
            mode="contained"
            onPress={proximoMes}
            style={styles.mesButton}
            labelStyle={styles.mesButtonLabel}
          >
            Próximo Mês
          </Button>
        </View>

        {/* Busca */}
        <Searchbar
          placeholder="Pesquisar despesas..."
          onChangeText={setBusca}
          value={busca}
          style={styles.searchBar}
          iconColor="#fff"
          inputStyle={{ color: '#fff' }}
          placeholderTextColor="#999"
        />

        {/* Filtros */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtrosContainer}>
          <Chip
            selected={filtroAtivo === 'todos'}
            onPress={() => setFiltroAtivo('todos')}
            style={[styles.filtroChip, filtroAtivo === 'todos' && styles.filtroChipAtivo]}
            textStyle={styles.filtroChipText}
          >
            Todos ({contadores.todos})
          </Chip>
          <Chip
            selected={filtroAtivo === 'gastos-fixos'}
            onPress={() => setFiltroAtivo('gastos-fixos')}
            style={[styles.filtroChip, filtroAtivo === 'gastos-fixos' && styles.filtroChipAtivo]}
            textStyle={styles.filtroChipText}
          >
            Gastos Fixos ({contadores.gastosFixos})
          </Chip>
          <Chip
            selected={filtroAtivo === 'gastos-variaveis'}
            onPress={() => setFiltroAtivo('gastos-variaveis')}
            style={[styles.filtroChip, filtroAtivo === 'gastos-variaveis' && styles.filtroChipAtivo]}
            textStyle={styles.filtroChipText}
          >
            Gastos Variáveis ({contadores.gastosVariaveis})
          </Chip>
          <Chip
            selected={filtroAtivo === 'ganhos'}
            onPress={() => setFiltroAtivo('ganhos')}
            style={[styles.filtroChip, filtroAtivo === 'ganhos' && styles.filtroChipAtivo]}
            textStyle={styles.filtroChipText}
          >
            Ganhos ({contadores.ganhos})
          </Chip>
        </ScrollView>

        {/* Resumo */}
        <Card style={styles.resumoCard}>
          <Card.Content>
            <View style={styles.resumoRow}>
              <View style={styles.resumoItem}>
                <Text style={styles.resumoLabel}>Gastos</Text>
                <Text style={styles.gastoValor}>
                  R$ {formatarValor(totais.gastos)}
                </Text>
              </View>
              <View style={styles.resumoItem}>
                <Text style={styles.resumoLabel}>Ganhos</Text>
                <Text style={styles.ganhoValor}>
                  R$ {formatarValor(totais.ganhos)}
                </Text>
              </View>
              <View style={styles.resumoItem}>
                <Text style={styles.resumoLabel}>Saldo</Text>
                <Text style={totais.saldo >= 0 ? styles.ganhoValor : styles.gastoValor}>
                  R$ {formatarValor(Math.abs(totais.saldo))}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Lista de Despesas Agrupadas */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Carregando despesas...</Text>
          </View>
        ) : (
          <ScrollView style={styles.lista}>
            {agruparPorCategoria().length === 0 ? (
              <Card style={styles.infoCard}>
                <Card.Content>
                  <Text style={styles.infoText}>📊 Movimentações Recentes</Text>
                  <Text style={styles.semDados}>Nenhuma movimentação neste mês</Text>
                </Card.Content>
              </Card>
            ) : (
              agruparPorCategoria().map((grupo) => (
                <Card key={grupo.nome} style={styles.categoriaCard}>
                  <Card.Content>
                    <TouchableOpacity
                      onPress={() => toggleExpandir(grupo.nome)}
                      style={styles.categoriaHeader}
                    >
                      <View style={styles.categoriaInfo}>
                        <Text style={styles.categoriaNome}>{grupo.nome}</Text>
                        {grupo.tipo === 'GANHO' ? (
                          <View style={styles.chipGanho}>
                            <Text style={styles.chipText}>GANHO</Text>
                          </View>
                        ) : grupo.despesas[0]?.DespesaFixa ? (
                          <View style={styles.chipFixa}>
                            <Text style={styles.chipText}>FIXO</Text>
                          </View>
                        ) : (
                          <View style={styles.chipVariavel}>
                            <Text style={styles.chipText}>VARIÁVEL</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.categoriaRight}>
                        <Text 
                          style={[
                            styles.categoriaTotal,
                            grupo.tipo === 'GANHO' ? styles.ganhoValor : styles.gastoValor
                          ]}
                        >
                          {grupo.tipo === 'GANHO' ? '+ ' : ''}R$ {formatarValor(grupo.total)}
                        </Text>
                        <IconButton
                          icon={expandidas[grupo.nome] ? 'chevron-up' : 'chevron-down'}
                          size={24}
                          iconColor="#2196F3"
                        />
                      </View>
                    </TouchableOpacity>

                    {expandidas[grupo.nome] && (
                      <View style={styles.despesasExpandidas}>
                        <Divider style={styles.divider} />
                        {grupo.despesas.map((despesa) => (
                          <View key={despesa.id} style={styles.despesaItem}>
                            <View style={styles.despesaInfo}>
                              <Text style={styles.despesaNome}>{despesa.nomeDespesa}</Text>
                              <Text style={styles.despesaData}>
                                {formatarData(despesa.date)}
                              </Text>
                              {despesa.descDespesa && (
                                <Text style={styles.despesaDesc}>{despesa.descDespesa}</Text>
                              )}
                              {despesa.categoria && (
                                <Text style={styles.despesaCategoria}>
                                  {despesa.categoria.nomeCategoria}
                                </Text>
                              )}
                            </View>
                            <View style={styles.despesaActions}>
                              <Text 
                                style={[
                                  styles.despesaValor,
                                  despesa.tipoMovimento === 'GANHO' ? styles.ganhoValor : styles.gastoValor
                                ]}
                              >
                                {despesa.tipoMovimento === 'GANHO' ? '+ ' : ''}
                                R$ {formatarValor(despesa.valorDespesa || 0)}
                              </Text>
                              {despesa.tipoMovimento === 'GASTO' && (
                                <Text style={styles.tipoGasto}>
                                  {despesa.DespesaFixa ? 'Fixo' : 'Variável'}
                                </Text>
                              )}
                              <View style={styles.actionButtons}>
                                <IconButton
                                  icon="pencil"
                                  size={20}
                                  iconColor="#2196F3"
                                  onPress={() => abrirEdicao(despesa)}
                                />
                                <IconButton
                                  icon="delete"
                                  size={20}
                                  iconColor="#f44336"
                                  onPress={() => excluirDespesa(despesa.id)}
                                />
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </Card.Content>
                </Card>
              ))
            )}
          </ScrollView>
        )}
      </View>

      <FAB
        icon="plus"
        style={[styles.fab, { bottom: 16 + insets.bottom }]}
        onPress={() => setModalVisible(true)}
        label="Adicionar"
      />

      {/* Modal Adicionar Despesa */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>Adicionar Despesa</Text>

            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Tipo</Text>
              <Picker
                selectedValue={tipoMovimento}
                onValueChange={setTipoMovimento}
                style={styles.picker}
                dropdownIconColor="#fff"
              >
                <Picker.Item label="Gasto" value="GASTO" />
                <Picker.Item label="Ganho" value="GANHO" />
              </Picker>
            </View>

            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Nome da despesa/ganho</Text>
              <Picker
                selectedValue={nomeDespesa}
                onValueChange={setNomeDespesa}
                style={styles.picker}
                dropdownIconColor="#fff"
              >
                <Picker.Item label="Nome da despesa/ganho" value="" />
                {categorias.map((cat) => (
                  <Picker.Item
                    key={cat.id}
                    label={cat.nomeCategoria}
                    value={cat.nomeCategoria}
                  />
                ))}
              </Picker>
            </View>

            <TextInput
              label="Valor (R$) *"
              value={valorDespesa}
              onChangeText={setValorDespesa}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              theme={{ colors: { primary: '#2196F3' } }}
            />

            <TextInput
              label="Descrição"
              value={descDespesa}
              onChangeText={setDescDespesa}
              mode="outlined"
              multiline
              numberOfLines={2}
              style={styles.input}
              theme={{ colors: { primary: '#2196F3' } }}
            />

            <TextInput
              label="Data *"
              value={dataDespesa}
              onChangeText={setDataDespesa}
              mode="outlined"
              placeholder="YYYY-MM-DD"
              style={styles.input}
              theme={{ colors: { primary: '#2196F3' } }}
            />

            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Selecione a categoria</Text>
              <Picker
                selectedValue={categoriaId}
                onValueChange={setCategoriaId}
                style={styles.picker}
                dropdownIconColor="#fff"
              >
                <Picker.Item label="Selecione a categoria" value="" />
                {categorias.map((cat) => (
                  <Picker.Item
                    key={cat.id}
                    label={cat.nomeCategoria}
                    value={cat.id.toString()}
                  />
                ))}
              </Picker>
            </View>

            {tipoMovimento === 'GASTO' && (
              <>
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerLabel}>Gasto</Text>
                  <Picker
                    selectedValue={despesaFixa}
                    onValueChange={setDespesaFixa}
                    style={styles.picker}
                    dropdownIconColor="#fff"
                  >
                    <Picker.Item label="Variável" value="Variável" />
                    <Picker.Item label="Fixa" value="Fixa" />
                  </Picker>
                </View>

                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerLabel}>VALE?</Text>
                  <Picker
                    selectedValue={isVale}
                    onValueChange={setIsVale}
                    style={styles.picker}
                    dropdownIconColor="#fff"
                  >
                    <Picker.Item label="Não" value="Não" />
                    <Picker.Item label="Sim" value="Sim" />
                  </Picker>
                </View>
              </>
            )}

            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => setModalVisible(false)}
                style={styles.modalButton}
                labelStyle={styles.cancelButtonLabel}
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={adicionarDespesa}
                loading={saving}
                disabled={saving}
                style={[styles.modalButton, styles.saveButton]}
              >
                Salvar
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* Modal Editar Despesa */}
      <Portal>
        <Modal
          visible={modalEditVisible}
          onDismiss={() => setModalEditVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>Editar Despesa</Text>

            <TextInput
              label="Nome *"
              value={nomeDespesa}
              onChangeText={setNomeDespesa}
              mode="outlined"
              style={styles.input}
              theme={{ colors: { primary: '#2196F3' } }}
            />

            <TextInput
              label="Valor (R$) *"
              value={valorDespesa}
              onChangeText={setValorDespesa}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              theme={{ colors: { primary: '#2196F3' } }}
            />

            <TextInput
              label="Descrição"
              value={descDespesa}
              onChangeText={setDescDespesa}
              mode="outlined"
              multiline
              numberOfLines={2}
              style={styles.input}
              theme={{ colors: { primary: '#2196F3' } }}
            />

            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Tipo</Text>
              <Picker
                selectedValue={tipoMovimento}
                onValueChange={setTipoMovimento}
                style={styles.picker}
                dropdownIconColor="#fff"
              >
                <Picker.Item label="Gasto" value="GASTO" />
                <Picker.Item label="Ganho" value="GANHO" />
              </Picker>
            </View>

            <View style={styles.pickerContainer}>
              <Text style={styles.pickerLabel}>Categoria</Text>
              <Picker
                selectedValue={categoriaId}
                onValueChange={setCategoriaId}
                style={styles.picker}
                dropdownIconColor="#fff"
              >
                <Picker.Item label="Sem categoria" value="" />
                {categorias.map((cat) => (
                  <Picker.Item
                    key={cat.id}
                    label={cat.nomeCategoria}
                    value={cat.id.toString()}
                  />
                ))}
              </Picker>
            </View>

            <TextInput
              label="Data"
              value={dataDespesa}
              onChangeText={setDataDespesa}
              mode="outlined"
              placeholder="YYYY-MM-DD"
              style={styles.input}
              theme={{ colors: { primary: '#2196F3' } }}
            />

            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => setModalEditVisible(false)}
                style={styles.modalButton}
                labelStyle={styles.cancelButtonLabel}
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={editarDespesa}
                loading={saving}
                disabled={saving}
                style={[styles.modalButton, styles.saveButton]}
              >
                Atualizar
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* Modal Gerenciar Categorias */}
      <Portal>
        <Modal
          visible={catModalVisible}
          onDismiss={() => setCatModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>Gerenciar Categorias</Text>

            <View style={styles.catAddRow}>
              <TextInput
                label="Nova categoria"
                value={novaCategoria}
                onChangeText={setNovaCategoria}
                mode="outlined"
                style={styles.catAddInput}
                theme={{ colors: { primary: '#2196F3' } }}
              />
              <Button
                mode="contained"
                onPress={adicionarCategoria}
                loading={savingCat}
                disabled={savingCat}
                style={styles.saveButton}
              >
                Add
              </Button>
            </View>

            <Divider style={styles.divider} />

            {categorias.length === 0 ? (
              <Text style={styles.semDados}>Nenhuma categoria cadastrada</Text>
            ) : (
              categorias.map((cat) => (
                <View key={cat.id} style={styles.catRow}>
                  {catEditandoId === cat.id ? (
                    <>
                      <TextInput
                        value={catEditNome}
                        onChangeText={setCatEditNome}
                        mode="outlined"
                        dense
                        style={styles.catEditInput}
                        theme={{ colors: { primary: '#2196F3' } }}
                      />
                      <IconButton
                        icon="check"
                        size={20}
                        iconColor="#4caf50"
                        onPress={salvarEdicaoCategoria}
                      />
                      <IconButton
                        icon="close"
                        size={20}
                        iconColor="#999"
                        onPress={() => {
                          setCatEditandoId(null);
                          setCatEditNome('');
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <Text style={styles.catNome}>{cat.nomeCategoria}</Text>
                      <IconButton
                        icon="pencil"
                        size={20}
                        iconColor="#2196F3"
                        onPress={() => {
                          setCatEditandoId(cat.id);
                          setCatEditNome(cat.nomeCategoria);
                        }}
                      />
                      <IconButton
                        icon="delete"
                        size={20}
                        iconColor="#f44336"
                        onPress={() => excluirCategoria(cat)}
                      />
                    </>
                  )}
                </View>
              ))
            )}

            <Button
              mode="outlined"
              onPress={() => setCatModalVisible(false)}
              style={[styles.modalButton, { marginTop: 16 }]}
              labelStyle={styles.cancelButtonLabel}
            >
              Fechar
            </Button>
          </ScrollView>
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
  catAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  catAddInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  catNome: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  catEditInput: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    backgroundColor: '#000',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  mesNavegacao: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  mesButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    flex: 1,
  },
  mesButtonLabel: {
    fontSize: 12,
    color: '#fff',
  },
  mesAtual: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    minWidth: 120,
  },
  searchBar: {
    marginBottom: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  filtrosContainer: {
    marginBottom: 8,
    maxHeight: 40,
  },
  filtroChip: {
    marginRight: 8,
    backgroundColor: '#1a1a1a',
    height: 36,
  },
  filtroChipAtivo: {
    backgroundColor: '#2196F3',
  },
  filtroChipText: {
    color: '#fff',
    fontSize: 13,
  },
  resumoCard: {
    backgroundColor: '#1a1a1a',
    marginBottom: 8,
    borderRadius: 12,
  },
  resumoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  resumoItem: {
    alignItems: 'center',
  },
  resumoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  gastoValor: {
    color: '#f44336',
    fontSize: 18,
    fontWeight: 'bold',
  },
  ganhoValor: {
    color: '#2196F3',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  loadingText: {
    color: '#999',
    marginTop: 16,
    fontSize: 16,
  },
  lista: {
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  infoText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  semDados: {
    color: '#999',
    textAlign: 'center',
    fontSize: 14,
  },
  categoriaCard: {
    backgroundColor: '#1a1a1a',
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  categoriaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    minHeight: 40,
  },
  categoriaInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    paddingRight: 8,
  },
  categoriaNome: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  chipFixa: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chipVariavel: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chipGanho: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  chipText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  categoriaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  categoriaTotal: {
    fontSize: 15,
    fontWeight: 'bold',
    marginRight: 4,
  },
  despesasExpandidas: {
    marginTop: 8,
  },
  divider: {
    backgroundColor: '#333',
    marginVertical: 8,
  },
  despesaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  despesaInfo: {
    flex: 1,
  },
  despesaNome: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  despesaData: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  despesaDesc: {
    color: '#2196F3',
    fontSize: 12,
    marginTop: 2,
  },
  despesaCategoria: {
    color: '#999',
    fontSize: 11,
    marginTop: 2,
  },
  despesaActions: {
    alignItems: 'flex-end',
  },
  despesaValor: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  tipoGasto: {
    color: '#999',
    fontSize: 11,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#9C27B0',
  },
  modal: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    margin: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#2a2a2a',
  },
  pickerContainer: {
    marginBottom: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#444',
  },
  pickerLabel: {
    color: '#999',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  picker: {
    color: '#fff',
    backgroundColor: 'transparent',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
  cancelButtonLabel: {
    color: '#999',
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
});
