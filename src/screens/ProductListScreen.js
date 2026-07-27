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
  Searchbar,
  Chip,
} from 'react-native-paper';
import api from '../services/api';

export default function ProductListScreen({ navigation }) {
  const [produtos, setProdutos] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);

  // Form fields
  const [nomeProduto, setNomeProduto] = useState('');
  const [preco, setPreco] = useState('');
  const [estoque, setEstoque] = useState('');
  const [descricao, setDescricao] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');

  // Configuração de PDV do produto selecionado
  const [baseUnitEdit, setBaseUnitEdit] = useState(null);
  const [hiddenUnitsEdit, setHiddenUnitsEdit] = useState([]);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    carregarProdutos();
  }, []);

  const carregarProdutos = async () => {
    try {
      console.log('🔵 Carregando produtos...');
      const response = await api.get('/api/products');
      console.log('✅ Produtos carregados:', response.data);
      console.log('📊 Total de produtos:', response.data?.length);
      setProdutos(response.data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar produtos:', error);
    }
  };

  const adicionarProduto = async () => {
    if (!nomeProduto || !preco) {
      Alert.alert('Atenção', 'Preencha os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/products', {
        name: nomeProduto,
        value: parseFloat(preco),
        valuecusto: parseFloat(preco) * 0.7, // custo estimado
        quantity: estoque ? parseInt(estoque) : 0,
        unit: 'un',
        categoryId: null,
      });

      Alert.alert('Sucesso', 'Produto cadastrado!');
      setModalVisible(false);
      limparForm();
      carregarProdutos();
    } catch (error) {
      Alert.alert('Erro', 'Erro ao cadastrar produto');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const atualizarEstoque = async (produtoId, quantidade, tipo) => {
    try {
      await api.put(`/api/produtos/${produtoId}/estoque`, {
        quantidade: parseInt(quantidade),
        tipo, // 'adicionar' ou 'remover'
        data: new Date().toISOString(),
      });
      Alert.alert('Sucesso', 'Estoque atualizado!');
      carregarProdutos();
      setModalDetalhes(false);
    } catch (error) {
      Alert.alert('Erro', 'Erro ao atualizar estoque');
    }
  };

  const verDetalhes = (produto) => {
    setProdutoSelecionado(produto);
    setBaseUnitEdit(produto.baseUnit || null);
    setHiddenUnitsEdit(Array.isArray(produto.pdvHiddenUnits) ? produto.pdvHiddenUnits : []);
    setModalDetalhes(true);
  };

  // Unidades disponíveis do produto (a partir dos itens de estoque + unidade padrão)
  const unidadesDoProduto = (produto) => {
    if (!produto) return [];
    const units = (produto.estoqueItems || []).map((e) => e.unit);
    if (produto.unit) units.push(produto.unit);
    return [...new Set(units.filter(Boolean))];
  };

  const toggleUnidadePdv = (unit) => {
    setHiddenUnitsEdit((prev) =>
      prev.includes(unit) ? prev.filter((u) => u !== unit) : [...prev, unit]
    );
  };

  const salvarConfigPdv = async () => {
    if (!produtoSelecionado) return;
    setSavingConfig(true);
    try {
      await api.put(`/api/products/${produtoSelecionado.id}`, {
        name: produtoSelecionado.name,
        quantity: produtoSelecionado.quantity ?? 0,
        unit: produtoSelecionado.unit,
        value: produtoSelecionado.value,
        valuecusto: produtoSelecionado.valuecusto,
        categoryId: produtoSelecionado.categoryId || null,
        baseUnit: baseUnitEdit || null,
        pdvHiddenUnits: hiddenUnitsEdit,
      });
      Alert.alert('Sucesso', 'Configuração do PDV salva!');
      setModalDetalhes(false);
      carregarProdutos();
    } catch (error) {
      const msg = error.response?.data?.error || 'Erro ao salvar configuração';
      Alert.alert('Erro', msg);
    } finally {
      setSavingConfig(false);
    }
  };

  const limparForm = () => {
    setNomeProduto('');
    setPreco('');
    setEstoque('');
    setDescricao('');
    setCodigoBarras('');
  };

  const produtosFiltrados = produtos.filter(
    (p) =>
      p.name?.toLowerCase().includes(busca.toLowerCase()) ||
      p.id?.toString().includes(busca)
  );

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Produtos" />
      </Appbar.Header>

      <View style={styles.content}>
        <Searchbar
          placeholder="Buscar produto"
          onChangeText={setBusca}
          value={busca}
          style={styles.searchBar}
        />

        <ScrollView style={styles.lista}>
          {produtosFiltrados.length === 0 ? (
            <Text style={styles.semDados}>Nenhum produto cadastrado</Text>
          ) : (
            produtosFiltrados.map((produto) => (
              <Card
                key={produto.id}
                style={styles.produtoCard}
                onPress={() => verDetalhes(produto)}
              >
                <Card.Content>
                  <View style={styles.produtoHeader}>
                    <View style={styles.produtoInfo}>
                      <Text style={styles.produtoNome}>{produto.name}</Text>
                      {produto.category && (
                        <Text style={styles.produtoCodigo}>
                          {produto.category.name}
                        </Text>
                      )}
                    </View>
                    <View style={styles.produtoPrecoContainer}>
                      <Text style={styles.produtoPreco}>
                        R$ {produto.value?.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.produtoFooter}>
                    <Chip
                      mode="outlined"
                      icon="package-variant"
                      style={[
                        styles.estoqueChip,
                        produto.quantity <= 5 ? styles.estoqueBaixo : {},
                      ]}
                    >
                      Estoque: {produto.quantity || 0} {produto.unit}
                    </Chip>
                  </View>
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
      />

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>Novo Produto</Text>

            <TextInput
              label="Nome do Produto *"
              value={nomeProduto}
              onChangeText={setNomeProduto}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Preço *"
              value={preco}
              onChangeText={setPreco}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <TextInput
              label="Estoque Inicial"
              value={estoque}
              onChangeText={setEstoque}
              mode="outlined"
              keyboardType="number-pad"
              style={styles.input}
            />

            <TextInput
              label="Código de Barras"
              value={codigoBarras}
              onChangeText={setCodigoBarras}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Descrição"
              value={descricao}
              onChangeText={setDescricao}
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
                onPress={adicionarProduto}
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
          {produtoSelecionado && (
            <>
              <Text style={styles.modalTitle}>{produtoSelecionado.name}</Text>

              <View style={styles.detalheItem}>
                <Text style={styles.detalheLabel}>Preço Venda:</Text>
                <Text style={styles.detalheValor}>
                  R$ {produtoSelecionado.value?.toFixed(2)}
                </Text>
              </View>

              <View style={styles.detalheItem}>
                <Text style={styles.detalheLabel}>Preço Custo:</Text>
                <Text style={styles.detalheValor}>
                  R$ {produtoSelecionado.valuecusto?.toFixed(2)}
                </Text>
              </View>

              <View style={styles.detalheItem}>
                <Text style={styles.detalheLabel}>Estoque Atual:</Text>
                <Text
                  style={[
                    styles.detalheValor,
                    styles.estoqueValor,
                    produtoSelecionado.quantity <= 5 ? styles.estoqueBaixoTexto : {},
                  ]}
                >
                  {produtoSelecionado.quantity || 0} {produtoSelecionado.unit}
                </Text>
              </View>

              {produtoSelecionado.category && (
                <View style={styles.detalheItem}>
                  <Text style={styles.detalheLabel}>Categoria:</Text>
                  <Text style={styles.detalheValor}>
                    {produtoSelecionado.category.name}
                  </Text>
                </View>
              )}

              <View style={styles.estoqueButtons}>
                <Button
                  mode="contained"
                  icon="plus"
                  onPress={() => {
                    Alert.prompt(
                      'Adicionar Estoque',
                      'Quantidade a adicionar:',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Confirmar',
                          onPress: (qtd) =>
                            atualizarEstoque(produtoSelecionado.id, qtd, 'adicionar'),
                        },
                      ],
                      'plain-text'
                    );
                  }}
                  style={[styles.estoqueButton, styles.adicionarButton]}
                >
                  Adicionar
                </Button>
                <Button
                  mode="contained"
                  icon="minus"
                  onPress={() => {
                    Alert.prompt(
                      'Remover Estoque',
                      'Quantidade a remover:',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Confirmar',
                          onPress: (qtd) =>
                            atualizarEstoque(produtoSelecionado.id, qtd, 'remover'),
                        },
                      ],
                      'plain-text'
                    );
                  }}
                  style={[styles.estoqueButton, styles.removerButton]}
                >
                  Remover
                </Button>
              </View>

              <View style={styles.configSection}>
                <Text style={styles.configTitulo}>Configurações do PDV</Text>

                <Text style={styles.configLabel}>Unidade base (conversão):</Text>
                <View style={styles.configChips}>
                  <Chip
                    selected={!baseUnitEdit}
                    onPress={() => setBaseUnitEdit(null)}
                    style={styles.configChip}
                  >
                    Automático
                  </Chip>
                  {unidadesDoProduto(produtoSelecionado).map((u) => (
                    <Chip
                      key={u}
                      selected={baseUnitEdit === u}
                      onPress={() => setBaseUnitEdit(u)}
                      style={styles.configChip}
                    >
                      {u}
                    </Chip>
                  ))}
                </View>

                <Text style={styles.configLabel}>Unidades visíveis no PDV:</Text>
                <View style={styles.configChips}>
                  {unidadesDoProduto(produtoSelecionado).map((u) => {
                    const oculta = hiddenUnitsEdit.includes(u);
                    return (
                      <Chip
                        key={u}
                        selected={!oculta}
                        icon={oculta ? 'eye-off' : 'eye'}
                        onPress={() => toggleUnidadePdv(u)}
                        style={styles.configChip}
                      >
                        {u}
                      </Chip>
                    );
                  })}
                </View>
                {unidadesDoProduto(produtoSelecionado).length === 0 && (
                  <Text style={styles.configVazio}>Nenhuma unidade em estoque.</Text>
                )}

                <Button
                  mode="contained"
                  icon="content-save"
                  onPress={salvarConfigPdv}
                  loading={savingConfig}
                  disabled={savingConfig}
                  style={styles.salvarConfigButton}
                >
                  Salvar configuração
                </Button>
              </View>

              <Button
                mode="outlined"
                onPress={() => setModalDetalhes(false)}
                style={styles.fecharButton}
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
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchBar: {
    marginBottom: 16,
  },
  lista: {
    flex: 1,
  },
  semDados: {
    textAlign: 'center',
    padding: 40,
    color: '#999',
    fontSize: 16,
  },
  produtoCard: {
    marginBottom: 12,
  },
  produtoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  produtoInfo: {
    flex: 1,
  },
  produtoNome: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  produtoCodigo: {
    fontSize: 12,
    color: '#666',
  },
  produtoPrecoContainer: {
    marginLeft: 12,
  },
  produtoPreco: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  produtoFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  estoqueChip: {
    backgroundColor: '#E3F2FD',
  },
  estoqueBaixo: {
    backgroundColor: '#FFEBEE',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#8BC34A',
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '90%',
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
  estoqueValor: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  estoqueBaixoTexto: {
    color: '#F44336',
  },
  estoqueButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  estoqueButton: {
    flex: 1,
  },
  adicionarButton: {
    backgroundColor: '#2196F3',
  },
  removerButton: {
    backgroundColor: '#F44336',
  },
  fecharButton: {
    marginTop: 8,
  },
  configSection: {
    marginTop: 8,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  configTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  configLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  configChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  configChip: {
    marginRight: 6,
    marginBottom: 6,
  },
  configVazio: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  salvarConfigButton: {
    marginTop: 12,
    backgroundColor: '#8BC34A',
  },
});
