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
  List,
  Chip,
  IconButton,
} from 'react-native-paper';
import api from '../services/api';
import { formatarValor } from '../utils/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MachineScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [maquinas, setMaquinas] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [maquinaSelecionada, setMaquinaSelecionada] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form fields
  const [nomeMaquina, setNomeMaquina] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const [valorContador, setValorContador] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    carregarMaquinas();
  }, []);

  const carregarMaquinas = async () => {
    try {
      const response = await api.get('/api/machines');
      setMaquinas(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar máquinas:', error);
    }
  };

  const adicionarMaquina = async () => {
    if (!nomeMaquina) {
      Alert.alert('Atenção', 'Informe o nome da máquina');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/machines', {
        nomeMaquina,
        localizacao: localizacao || null,
        contadorAtual: valorContador ? parseInt(valorContador) : 0,
        observacoes: observacoes || null,
        dataCadastro: new Date().toISOString(),
      });

      Alert.alert('Sucesso', 'Máquina cadastrada!');
      setModalVisible(false);
      limparForm();
      carregarMaquinas();
    } catch (error) {
      Alert.alert('Erro', 'Erro ao cadastrar máquina');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const atualizarContador = async (maquinaId, novoValor) => {
    try {
      await api.put(`/api/machines/${maquinaId}`, {
        contadorAtual: parseInt(novoValor),
        dataAtualizacao: new Date().toISOString(),
      });
      Alert.alert('Sucesso', 'Contador atualizado!');
      carregarMaquinas();
      setModalDetalhes(false);
    } catch (error) {
      Alert.alert('Erro', 'Erro ao atualizar contador');
    }
  };

  const verDetalhes = (maquina) => {
    setMaquinaSelecionada(maquina);
    setModalDetalhes(true);
  };

  const limparForm = () => {
    setNomeMaquina('');
    setLocalizacao('');
    setValorContador('');
    setObservacoes('');
  };

  const calcularRendimento = (maquina) => {
    const jogadas = maquina.contadorAtual || 0;
    const valorJogada = maquina.valorJogada || 1;
    return jogadas * valorJogada;
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Máquinas" />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {maquinas.length === 0 ? (
          <Text style={styles.semDados}>Nenhuma máquina cadastrada</Text>
        ) : (
          maquinas.map((maquina) => (
            <Card
              key={maquina.id}
              style={styles.maquinaCard}
              onPress={() => verDetalhes(maquina)}
            >
              <Card.Content>
                <View style={styles.maquinaHeader}>
                  <View style={styles.maquinaInfo}>
                    <Text style={styles.maquinaNome}>{maquina.nomeMaquina}</Text>
                    {maquina.localizacao && (
                      <Text style={styles.maquinaLocal}>
                        📍 {maquina.localizacao}
                      </Text>
                    )}
                  </View>
                  <Chip
                    mode="flat"
                    style={[
                      styles.statusChip,
                      maquina.ativo ? styles.ativoChip : styles.inativoChip,
                    ]}
                  >
                    {maquina.ativo ? 'Ativa' : 'Inativa'}
                  </Chip>
                </View>

                <View style={styles.maquinaStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Contador</Text>
                    <Text style={styles.statValor}>
                      {maquina.contadorAtual || 0}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Rendimento</Text>
                    <Text style={styles.statValor}>
                      R$ {formatarValor(calcularRendimento(maquina))}
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={[styles.fab, { bottom: 16 + insets.bottom }]}
        onPress={() => setModalVisible(true)}
      />

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>Nova Máquina</Text>

            <TextInput
              label="Nome da Máquina *"
              value={nomeMaquina}
              onChangeText={setNomeMaquina}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Localização"
              value={localizacao}
              onChangeText={setLocalizacao}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Contador Inicial"
              value={valorContador}
              onChangeText={setValorContador}
              mode="outlined"
              keyboardType="number-pad"
              style={styles.input}
            />

            <TextInput
              label="Observações"
              value={observacoes}
              onChangeText={setObservacoes}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
            />

            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => setModalVisible(false)}
                style={styles.modalButton}
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={adicionarMaquina}
                loading={loading}
                disabled={loading}
                style={styles.modalButton}
              >
                Salvar
              </Button>
            </View>
          </ScrollView>
        </Modal>

        <Modal
          visible={modalDetalhes}
          onDismiss={() => setModalDetalhes(false)}
          contentContainerStyle={styles.modal}
        >
          {maquinaSelecionada && (
            <>
              <Text style={styles.modalTitle}>{maquinaSelecionada.nomeMaquina}</Text>

              <View style={styles.detalheItem}>
                <Text style={styles.detalheLabel}>Localização:</Text>
                <Text style={styles.detalheValor}>
                  {maquinaSelecionada.localizacao || 'Não informada'}
                </Text>
              </View>

              <View style={styles.detalheItem}>
                <Text style={styles.detalheLabel}>Contador Atual:</Text>
                <Text style={styles.detalheValor}>
                  {maquinaSelecionada.contadorAtual || 0} jogadas
                </Text>
              </View>

              <View style={styles.detalheItem}>
                <Text style={styles.detalheLabel}>Rendimento:</Text>
                <Text style={styles.detalheValor}>
                  R$ {formatarValor(calcularRendimento(maquinaSelecionada))}
                </Text>
              </View>

              {maquinaSelecionada.observacoes && (
                <View style={styles.detalheItem}>
                  <Text style={styles.detalheLabel}>Observações:</Text>
                  <Text style={styles.detalheValor}>
                    {maquinaSelecionada.observacoes}
                  </Text>
                </View>
              )}

              <View style={styles.modalButtons}>
                <Button
                  mode="outlined"
                  onPress={() => setModalDetalhes(false)}
                  style={styles.modalButton}
                >
                  Fechar
                </Button>
                <Button
                  mode="contained"
                  onPress={() => {
                    Alert.prompt(
                      'Atualizar Contador',
                      'Digite o novo valor do contador:',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Atualizar',
                          onPress: (valor) =>
                            atualizarContador(maquinaSelecionada.id, valor),
                        },
                      ],
                      'plain-text',
                      (maquinaSelecionada.contadorAtual || 0).toString()
                    );
                  }}
                  style={styles.modalButton}
                >
                  Atualizar Contador
                </Button>
              </View>
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
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  semDados: {
    textAlign: 'center',
    padding: 40,
    color: '#999',
    fontSize: 16,
  },
  maquinaCard: {
    marginBottom: 12,
  },
  maquinaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  maquinaInfo: {
    flex: 1,
  },
  maquinaNome: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  maquinaLocal: {
    fontSize: 14,
    color: '#666',
  },
  statusChip: {
    marginLeft: 8,
  },
  ativoChip: {
    backgroundColor: '#2196F3',
  },
  inativoChip: {
    backgroundColor: '#9E9E9E',
  },
  maquinaStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValor: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00BCD4',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#00BCD4',
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 8,
  },
  modalButton: {
    flex: 1,
  },
  detalheItem: {
    marginBottom: 12,
  },
  detalheLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  detalheValor: {
    fontSize: 16,
    fontWeight: '500',
  },
});
