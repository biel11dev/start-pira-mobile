import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
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
  Switch,
  ActivityIndicator,
} from 'react-native-paper';
import api from '../services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AcessosScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [usuarios, setUsuarios] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  // Permissions
  const [caixa, setCaixa] = useState(false);
  const [produtos, setProdutos] = useState(false);
  const [maquinas, setMaquinas] = useState(false);
  const [fiado, setFiado] = useState(false);
  const [despesas, setDespesas] = useState(false);
  const [ponto, setPonto] = useState(false);
  const [acessos, setAcessos] = useState(false);
  const [baseProduto, setBaseProduto] = useState(false);
  const [pdv, setPdv] = useState(false);
  const [pessoal, setPessoal] = useState(false);

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const carregarUsuarios = async () => {
    try {
      const response = await api.get('/api/users');
      setUsuarios(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      Alert.alert('Erro', 'Não foi possível carregar os usuários');
    }
  };

  const adicionarUsuario = async () => {
    if (!username || !password || !name) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/register', {
        username,
        password,
        name,
      });

      Alert.alert('Sucesso', 'Usuário cadastrado!');
      setModalVisible(false);
      limparForm();
      carregarUsuarios();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao cadastrar usuário');
    } finally {
      setLoading(false);
    }
  };

  const atualizarPermissoes = async () => {
    if (!usuarioSelecionado) return;

    setLoading(true);
    try {
      await api.put(`/api/users/${usuarioSelecionado.id}`, {
        name: usuarioSelecionado.name,
        caixa,
        produtos,
        maquinas,
        fiado,
        despesas,
        ponto,
        acessos,
        base_produto: baseProduto,
        pdv,
        pessoal,
      });

      Alert.alert('Sucesso', 'Permissões atualizadas!');
      setModalDetalhes(false);
      carregarUsuarios();
    } catch (error) {
      Alert.alert('Erro', 'Erro ao atualizar permissões');
    } finally {
      setLoading(false);
    }
  };

  const verDetalhes = (usuario) => {
    setUsuarioSelecionado(usuario);
    setCaixa(usuario.caixa || false);
    setProdutos(usuario.produtos || false);
    setMaquinas(usuario.maquinas || false);
    setFiado(usuario.fiado || false);
    setDespesas(usuario.despesas || false);
    setPonto(usuario.ponto || false);
    setAcessos(usuario.acessos || false);
    setBaseProduto(usuario.base_produto || false);
    setPdv(usuario.pdv || false);
    setPessoal(usuario.pessoal || false);
    setModalDetalhes(true);
  };

  const limparForm = () => {
    setUsername('');
    setPassword('');
    setName('');
  };

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
        <Appbar.Content title="Acessos" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {usuarios.length === 0 ? (
          <Text style={styles.semDados}>Nenhum usuário cadastrado</Text>
        ) : (
          usuarios.map((usuario) => (
            <Card
              key={usuario.id}
              style={styles.usuarioCard}
              onPress={() => verDetalhes(usuario)}
            >
              <Card.Content>
                <Text style={styles.usuarioNome}>{usuario.name}</Text>
                <Text style={styles.usuarioUsername}>@{usuario.username}</Text>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <FAB
        style={[styles.fab, { bottom: 16 + insets.bottom }]}
        icon="plus"
        onPress={() => setModalVisible(true)}
      />

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>Novo Usuário</Text>

            <TextInput
              label="Nome Completo *"
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />

            <TextInput
              label="Username *"
              value={username}
              onChangeText={setUsername}
              mode="outlined"
              autoCapitalize="none"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />

            <TextInput
              label="Senha *"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
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
                onPress={adicionarUsuario}
                loading={loading}
                disabled={loading}
                style={styles.modalButton}
              >
                Cadastrar
              </Button>
            </View>
          </ScrollView>
        </Modal>

        <Modal
          visible={modalDetalhes}
          onDismiss={() => setModalDetalhes(false)}
          contentContainerStyle={styles.modal}
        >
          {usuarioSelecionado && (
            <ScrollView>
              <Text style={styles.modalTitle}>{usuarioSelecionado.name}</Text>
              <Text style={styles.modalSubtitle}>Gerenciar Permissões</Text>

              <View style={styles.permissionItem}>
                <Text style={styles.permissionLabel}>Caixa</Text>
                <Switch value={caixa} onValueChange={setCaixa} />
              </View>

              <View style={styles.permissionItem}>
                <Text style={styles.permissionLabel}>Lista de Compras</Text>
                <Switch value={produtos} onValueChange={setProdutos} />
              </View>

              <View style={styles.permissionItem}>
                <Text style={styles.permissionLabel}>Máquinas</Text>
                <Switch value={maquinas} onValueChange={setMaquinas} />
              </View>

              <View style={styles.permissionItem}>
                <Text style={styles.permissionLabel}>Fiado</Text>
                <Switch value={fiado} onValueChange={setFiado} />
              </View>

              <View style={styles.permissionItem}>
                <Text style={styles.permissionLabel}>Despesas</Text>
                <Switch value={despesas} onValueChange={setDespesas} />
              </View>

              <View style={styles.permissionItem}>
                <Text style={styles.permissionLabel}>Ponto</Text>
                <Switch value={ponto} onValueChange={setPonto} />
              </View>

              <View style={styles.permissionItem}>
                <Text style={styles.permissionLabel}>Acessos</Text>
                <Switch value={acessos} onValueChange={setAcessos} />
              </View>

              <View style={styles.permissionItem}>
                <Text style={styles.permissionLabel}>Estoque</Text>
                <Switch value={baseProduto} onValueChange={setBaseProduto} />
              </View>

              <View style={styles.permissionItem}>
                <Text style={styles.permissionLabel}>PDV</Text>
                <Switch value={pdv} onValueChange={setPdv} />
              </View>

              <View style={styles.permissionItem}>
                <Text style={styles.permissionLabel}>Pessoal</Text>
                <Switch value={pessoal} onValueChange={setPessoal} />
              </View>

              <View style={styles.modalButtons}>
                <Button
                  mode="outlined"
                  onPress={() => setModalDetalhes(false)}
                  style={styles.modalButton}
                >
                  Cancelar
                </Button>
                <Button
                  mode="contained"
                  onPress={atualizarPermissoes}
                  loading={loading}
                  disabled={loading}
                  style={styles.modalButton}
                >
                  Salvar
                </Button>
              </View>
            </ScrollView>
          )}
        </Modal>
      </Portal>
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
  semDados: {
    textAlign: 'center',
    marginTop: 20,
    color: '#aaa',
  },
  usuarioCard: {
    marginBottom: 12,
    backgroundColor: '#1a1a1a',
  },
  usuarioNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  usuarioUsername: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#2196F3',
  },
  modal: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#fff',
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    color: '#aaa',
  },
  input: {
    marginBottom: 12,
  },
  permissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  permissionLabel: {
    fontSize: 16,
    color: '#fff',
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
});
