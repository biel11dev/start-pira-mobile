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
  FAB,
  Portal,
  Modal,
  IconButton,
  Divider,
} from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import api from '../services/api';

export default function DespesaScreen({ navigation }) {
  const [despesas, setDespesas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalEditVisible, setModalEditVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandidas, setExpandidas] = useState({});
  
  // Navegação de mês
  const [mesAtual, setMesAtual] = useState(new Date());

  // Form fields
  const [nomeDespesa, setNomeDespesa] = useState('');
  const [valorDespesa, setValorDespesa] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [dataDespesa, setDataDespesa] = useState(new Date().toISOString().split('T')[0]);
  const [despesaFixa, setDespesaFixa] = useState('Variável');

  // Edit
  const [despesaEditando, setDespesaEditando] = useState(null);

  useEffect(() => {
    carregarDados();
  }, [mesAtual]);

  const carregarDados = async () => {
    try {
      const [despesasRes, categoriasRes] = await Promise.all([
        api.get('/api/despesas'),
        api.get('/api/categories'),
      ]);
      setDespesas(despesasRes.data || []);
      setCategorias(categoriasRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar despesas:', error);
    }
  };

  const adicionarDespesa = async () => {
    if (!nomeDespesa || !valorDespesa) {
      Alert.alert('Atenção', 'Preencha os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/despesas', {
        nomeDespesa,
        valorDespesa: parseFloat(valorDespesa),
        descDespesa: descricao || null,
        date: dataDespesa,
        DespesaFixa: despesaFixa,
      });

      Alert.alert('Sucesso', 'Despesa registrada!');
      setModalVisible(false);
      limparForm();
      carregarDados();
    } catch (error) {
      Alert.alert('Erro', 'Erro ao registrar despesa');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const editarDespesa = async () => {
    if (!nomeDespesa || !valorDespesa) {
      Alert.alert('Atenção', 'Preencha os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      await api.put(`/api/despesas/${despesaEditando.id}`, {
        nomeDespesa,
        valorDespesa: parseFloat(valorDespesa),
        descDespesa: descricao || null,
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
      setLoading(false);
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
              await api.delete(`/api/despesas/${id}`);
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
    setNomeDespesa(despesa.nomeDespesa);
    setValorDespesa(despesa.valorDespesa?.toString() || '');
    setDescricao(despesa.descDespesa || '');
    setModalEditVisible(true);
  };

  const limparForm = () => {
    setNomeDespesa('');
    setValorDespesa('');
    setDescricao('');
    setCategoriaId('');
    setDataDespesa(new Date().toISOString().split('T')[0]);
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

  const agruparPorCategoria = () => {
    const grupos = {};
    
    despesasDoMes.forEach(despesa => {
      const categoria = despesa.nomeDespesa || 'Sem Categoria';
      
      if (!grupos[categoria]) {
        grupos[categoria] = {
          nome: categoria,
          despesas: [],
          total: 0,
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

  const calcularTotal = () => {
    return despesasDoMes.reduce((acc, d) => acc + (d.valorDespesa || 0), 0);
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

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
        <Appbar.Content title="Despesas Gerais" titleStyle={styles.headerTitle} />
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

        {/* Total de Despesas do Mês */}
        <Card style={styles.totalCard}>
          <Card.Content>
            <Text style={styles.totalLabel}>Total de Despesas</Text>
            <Text style={styles.totalValor}>
              R$ {formatarValor(calcularTotal())}
            </Text>
          </Card.Content>
        </Card>

        {/* Lista de Despesas Agrupadas por Categoria */}
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
                    </View>
                    <View style={styles.categoriaRight}>
                      <Text style={styles.categoriaTotal}>
                        Total: R$ {formatarValor(grupo.total)}
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
                          </View>
                          <View style={styles.despesaActions}>
                            <Text style={styles.despesaValor}>
                              R$ {formatarValor(despesa.valorDespesa || 0)}
                            </Text>
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
      </View>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        label="Adicionar Despesa"
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
              <Text style={styles.pickerLabel}>Selecione a despesa</Text>
              <Picker
                selectedValue={categoriaId}
                onValueChange={setCategoriaId}
                style={styles.picker}
                dropdownIconColor="#fff"
              >
                <Picker.Item label="Selecione a despesa" value="" />
                {categorias.map((cat) => (
                  <Picker.Item
                    key={cat.id}
                    label={cat.nome}
                    value={cat.id.toString()}
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
              value={descricao}
              onChangeText={setDescricao}
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
              <Text style={styles.pickerLabel}>Tipo</Text>
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
                loading={loading}
                disabled={loading}
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
              label="Nome da Despesa *"
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
              value={descricao}
              onChangeText={setDescricao}
              mode="outlined"
              multiline
              numberOfLines={2}
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
                loading={loading}
                disabled={loading}
                style={[styles.modalButton, styles.saveButton]}
              >
                Atualizar
              </Button>
            </View>
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
  totalCard: {
    backgroundColor: '#f44336',
    marginBottom: 16,
    borderRadius: 12,
  },
  totalLabel: {
    color: '#fff',
    fontSize: 14,
  },
  totalValor: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  lista: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    color: '#999',
    marginTop: 16,
    fontSize: 16,
  },
  infoCard: {
    backgroundColor: '#1a1a1a',
    marginBottom: 12,
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
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  categoriaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoriaInfo: {
    flex: 1,
  },
  categoriaNome: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  categoriaRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoriaTotal: {
    color: '#2196F3',
    fontSize: 16,
    fontWeight: 'bold',
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
  despesaActions: {
    alignItems: 'flex-end',
  },
  despesaValor: {
    color: '#4caf50',
    fontSize: 16,
    fontWeight: 'bold',
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
    backgroundColor: '#f44336',
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
