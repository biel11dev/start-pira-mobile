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
  Menu,
  Divider,
  IconButton,
  ActivityIndicator,
  SegmentedButtons,
} from 'react-native-paper';
import api from '../services/api';
import { formatarValor } from '../utils/format';
import { useAuth } from '../context/AuthContext';

export default function EstoqueScreen({ navigation }) {
  const { user } = useAuth();
  const [estoque, setEstoque] = useState([]);
  const [minimoMap, setMinimoMap] = useState({}); // estoqueId -> quantidadeMinima
  const [catalogo, setCatalogo] = useState([]); // /api/products
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);

  // Entrada de estoque (sem preço)
  const [entradaVisible, setEntradaVisible] = useState(false);
  const [entradaProduto, setEntradaProduto] = useState(null);
  const [entradaBusca, setEntradaBusca] = useState('');
  const [entradaQuantidade, setEntradaQuantidade] = useState('');
  const [entradaUnidade, setEntradaUnidade] = useState('un');
  const [entradaValor, setEntradaValor] = useState('');
  const [entradaCusto, setEntradaCusto] = useState('');
  const [entradaPickerVisible, setEntradaPickerVisible] = useState(false);
  const [savingEntrada, setSavingEntrada] = useState(false);

  // Quantidade ideal (mínimo)
  const [minimoVisible, setMinimoVisible] = useState(false);
  const [minimoItem, setMinimoItem] = useState(null);
  const [minimoValor, setMinimoValor] = useState('');
  const [savingMinimo, setSavingMinimo] = useState(false);

  // Conversão manual
  const [convVisible, setConvVisible] = useState(false);
  const [convItem, setConvItem] = useState(null);
  const [convModo, setConvModo] = useState('base'); // 'base' | 'empacotar' | 'dose'
  const [convQuantidade, setConvQuantidade] = useState('');
  const [convUnidadeAlvo, setConvUnidadeAlvo] = useState('');
  const [convDoseUnidade, setConvDoseUnidade] = useState('');
  const [convDoseRendimento, setConvDoseRendimento] = useState('');
  const [convDoseValor, setConvDoseValor] = useState('');
  const [savingConv, setSavingConv] = useState(false);

  // Editar item de estoque
  const [editVisible, setEditVisible] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', quantity: '', unit: '', value: '', valuecusto: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  // Excluir item de estoque (com senha)
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Componente (composição)
  const [compVisible, setCompVisible] = useState(false);
  const [compItem, setCompItem] = useState(null);
  const [composicoes, setComposicoes] = useState([]);
  const [loadingComp, setLoadingComp] = useState(false);
  const [novaCompNome, setNovaCompNome] = useState('');
  const [novaCompObrigatorio, setNovaCompObrigatorio] = useState(false);
  const [savingComp, setSavingComp] = useState(false);
  const [opcaoBusca, setOpcaoBusca] = useState('');
  const [opcaoGrupoId, setOpcaoGrupoId] = useState(null);

  // Unidades fracionais cadastradas (ex.: Dose) — para desmembramento automático
  const [unidadesFracionais, setUnidadesFracionais] = useState([]);

  useEffect(() => {
    carregarTudo();
  }, []);

  const carregarTudo = async () => {
    setLoading(true);
    try {
      const [est, min, cat, eqs] = await Promise.all([
        api.get('/api/estoque_prod'),
        api.get('/api/estoque-minimo'),
        api.get('/api/products'),
        api.get('/api/unit-equivalences'),
      ]);
      setEstoque(est.data || []);
      const mmap = {};
      (min.data || []).forEach((m) => {
        mmap[m.estoqueId] = m.quantidadeMinima;
      });
      setMinimoMap(mmap);
      setCatalogo(cat.data || []);
      setUnidadesFracionais(
        (eqs.data || [])
          .filter((e) => e.isFractional && e.fractionalValue > 0)
          .map((e) => e.unitName)
      );
    } catch (error) {
      console.error('❌ Erro ao carregar estoque:', error);
      Alert.alert('Erro', 'Não foi possível carregar o estoque');
    } finally {
      setLoading(false);
    }
  };

  const estaEmFalta = (item) => {
    const qtd = item.quantity ?? 0;
    const min = minimoMap[item.id];
    if (min != null) return qtd <= min;
    return qtd <= 0;
  };

  // ===== Entrada de estoque (sem preço de custo/venda) =====
  const abrirEntrada = () => {
    setEntradaProduto(null);
    setEntradaBusca('');
    setEntradaQuantidade('');
    setEntradaUnidade('un');
    setEntradaValor('');
    setEntradaCusto('');
    setEntradaPickerVisible(false);
    setEntradaVisible(true);
  };

  // Pré-preenche venda/custo conforme a unidade escolhida (usa unitPrices do
  // produto quando existir; senão o valor padrão do cadastro). Continua editável.
  useEffect(() => {
    if (!entradaProduto) return;
    const cfg =
      entradaProduto.unitPrices && typeof entradaProduto.unitPrices === 'object'
        ? entradaProduto.unitPrices[entradaUnidade]
        : null;
    setEntradaValor(
      cfg && cfg.value != null
        ? String(cfg.value)
        : entradaProduto.value != null
        ? String(entradaProduto.value)
        : ''
    );
    setEntradaCusto(
      cfg && cfg.cost != null
        ? String(cfg.cost)
        : entradaProduto.valuecusto != null
        ? String(entradaProduto.valuecusto)
        : ''
    );
  }, [entradaProduto, entradaUnidade]);

  const confirmarEntrada = async () => {
    if (!entradaProduto || !entradaQuantidade || !entradaUnidade) {
      Alert.alert('Atenção', 'Selecione o produto, informe a quantidade e a unidade.');
      return;
    }
    setSavingEntrada(true);
    try {
      const valorNum = parseFloat(String(entradaValor).replace(',', '.'));
      const custoNum = parseFloat(String(entradaCusto).replace(',', '.'));
      await api.post('/api/estoque_prod/entrada', {
        productId: entradaProduto.id,
        quantity: parseInt(entradaQuantidade, 10),
        unit: entradaUnidade,
        value: isNaN(valorNum) ? undefined : valorNum,
        valuecusto: isNaN(custoNum) ? undefined : custoNum,
      });
      Alert.alert('Sucesso', 'Entrada registrada no estoque!');
      setEntradaVisible(false);
      carregarTudo();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao dar entrada');
    } finally {
      setSavingEntrada(false);
    }
  };

  // ===== Quantidade ideal (mínimo) =====
  const abrirMinimo = (item) => {
    setMinimoItem(item);
    setMinimoValor(minimoMap[item.id] != null ? String(minimoMap[item.id]) : '');
    setMinimoVisible(true);
  };

  const salvarMinimo = async () => {
    if (!minimoItem) return;
    const valor = parseFloat(minimoValor);
    setSavingMinimo(true);
    try {
      if (!minimoValor || isNaN(valor) || valor <= 0) {
        await api.delete(`/api/estoque-minimo/${minimoItem.id}`);
        Alert.alert('Sucesso', 'Quantidade ideal removida.');
      } else {
        await api.post('/api/estoque-minimo', {
          estoqueId: minimoItem.id,
          quantidadeMinima: valor,
        });
        Alert.alert('Sucesso', 'Quantidade ideal definida.');
      }
      setMinimoVisible(false);
      carregarTudo();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao salvar quantidade ideal');
    } finally {
      setSavingMinimo(false);
    }
  };

  // ===== Conversão manual =====
  const abrirConversao = (item) => {
    setConvItem(item);
    setConvModo('base');
    setConvQuantidade('');
    setConvUnidadeAlvo('');
    setConvDoseUnidade('');
    setConvDoseRendimento('');
    setConvDoseValor('');
    setConvVisible(true);
  };

  const confirmarConversao = async () => {
    if (!convItem || !convQuantidade) {
      Alert.alert('Atenção', 'Informe a quantidade a converter.');
      return;
    }
    setSavingConv(true);
    try {
      if (convModo === 'base') {
        await api.post('/api/estoque_prod/converter', {
          estoqueId: convItem.id,
          quantityToConvert: parseInt(convQuantidade, 10),
        });
      } else if (convModo === 'empacotar') {
        if (!convUnidadeAlvo) {
          Alert.alert('Atenção', 'Informe a unidade de destino (ex: fardo, caixa).');
          setSavingConv(false);
          return;
        }
        await api.post('/api/estoque_prod/converter-reverso', {
          estoqueId: convItem.id,
          targetUnit: convUnidadeAlvo,
          quantityPacked: parseInt(convQuantidade, 10),
        });
      } else {
        // Porção / Dose (ex: 1 Garrafa -> 9 Doses)
        if (!convDoseUnidade.trim() || !convDoseRendimento || parseFloat(convDoseRendimento) <= 0) {
          Alert.alert('Atenção', 'Informe a unidade de destino e o rendimento por unidade.');
          setSavingConv(false);
          return;
        }
        await api.post('/api/estoque_prod/converter-dose', {
          estoqueId: convItem.id,
          quantityToConvert: parseInt(convQuantidade, 10),
          targetUnit: convDoseUnidade.trim(),
          yieldPerUnit: parseFloat(convDoseRendimento),
          targetValue: convDoseValor ? parseFloat(convDoseValor) : null,
          targetValueCusto: null,
        });
      }
      Alert.alert('Sucesso', 'Conversão realizada!');
      setConvVisible(false);
      carregarTudo();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro na conversão');
    } finally {
      setSavingConv(false);
    }
  };

  // ===== Editar item de estoque =====
  const abrirEdicao = (item) => {
    setEditItem(item);
    setEditForm({
      name: item.name || '',
      quantity: String(item.quantity ?? ''),
      unit: item.unit || '',
      value: item.value != null ? String(item.value) : '',
      valuecusto: item.valuecusto != null ? String(item.valuecusto) : '',
    });
    setEditVisible(true);
  };

  const salvarEdicao = async () => {
    if (!editItem || !editForm.name.trim()) {
      Alert.alert('Atenção', 'Informe o nome do item.');
      return;
    }
    setSavingEdit(true);
    try {
      await api.put(`/api/estoque_prod/${editItem.id}`, {
        name: editForm.name.trim(),
        quantity: parseInt(editForm.quantity, 10) || 0,
        unit: editForm.unit || 'un',
        value: parseFloat(editForm.value) || 0,
        valuecusto: parseFloat(editForm.valuecusto) || 0,
        categoryId: editItem.categoryId ?? editItem.category?.id ?? null,
        contabiliza: editItem.contabiliza ?? true,
      });
      Alert.alert('Sucesso', 'Item atualizado!');
      setEditVisible(false);
      carregarTudo();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao atualizar item');
    } finally {
      setSavingEdit(false);
    }
  };

  // ===== Excluir item de estoque (com senha) =====
  const abrirExclusao = (item) => {
    setDeleteItem(item);
    setDeletePassword('');
    setDeleteVisible(true);
  };

  const confirmarExclusao = async () => {
    if (!deleteItem) return;
    if (!deletePassword) {
      Alert.alert('Atenção', 'Informe sua senha para confirmar.');
      return;
    }
    setDeleteLoading(true);
    try {
      await api.post('/api/verify-password', {
        username: user?.username,
        password: deletePassword,
      });
      await api.delete(`/api/estoque_prod/${deleteItem.id}`);
      Alert.alert('Sucesso', 'Item excluído!');
      setDeleteVisible(false);
      carregarTudo();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Senha incorreta ou erro ao excluir');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ===== Componente (composição) =====
  const abrirComponente = async (item) => {
    setCompItem(item);
    setNovaCompNome('');
    setNovaCompObrigatorio(false);
    setOpcaoBusca('');
    setOpcaoGrupoId(null);
    setCompVisible(true);
    await carregarComposicoes(item.id);
  };

  const carregarComposicoes = async (estoqueId) => {
    setLoadingComp(true);
    try {
      const resp = await api.get(`/api/composicoes/${estoqueId}`);
      setComposicoes(resp.data || []);
    } catch (error) {
      console.error('Erro ao carregar composições:', error);
      setComposicoes([]);
    } finally {
      setLoadingComp(false);
    }
  };

  const adicionarGrupoComponente = async () => {
    if (!compItem || !novaCompNome.trim()) {
      Alert.alert('Atenção', 'Informe o nome do componente.');
      return;
    }
    setSavingComp(true);
    try {
      await api.post('/api/composicoes', {
        estoqueId: compItem.id,
        nome: novaCompNome.trim(),
        descricao: '',
        obrigatorio: novaCompObrigatorio,
        multiplo: false,
        minOpcoes: novaCompObrigatorio ? 1 : 0,
        maxOpcoes: 1,
        ordem: composicoes.length,
      });
      setNovaCompNome('');
      setNovaCompObrigatorio(false);
      await carregarComposicoes(compItem.id);
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao criar componente');
    } finally {
      setSavingComp(false);
    }
  };

  const removerGrupoComponente = async (grupoId) => {
    try {
      await api.delete(`/api/composicoes/${grupoId}`);
      await carregarComposicoes(compItem.id);
    } catch (error) {
      Alert.alert('Erro', 'Erro ao remover componente');
    }
  };

  // Resolve o item que será vinculado como opção: se o produto for adicionado
  // na unidade base mas possuir um registro de estoque em unidade fracional
  // (ex.: Dose), redireciona a opção para a unidade fracional. O desmembramento
  // é feito sob demanda na venda (conversão automática da unidade irmã).
  const resolverAlvoFracional = (item) => {
    const ehFracional = (u) => unidadesFracionais.includes(u);
    if (ehFracional(item.unit)) return item; // já é fracional
    const irmaoFracional = estoque.find(
      (e) =>
        e.productId === item.productId &&
        e.id !== item.id &&
        ehFracional(e.unit)
    );
    return irmaoFracional || item;
  };

  const adicionarOpcaoComponente = async (grupoId, estoqueOpcao) => {
    try {
      const alvo = resolverAlvoFracional(estoqueOpcao);
      await api.post(`/api/composicoes/${grupoId}/opcoes`, {
        nome: alvo.name,
        valorExtra: 0,
        estoqueId: alvo.id,
      });
      setOpcaoBusca('');
      setOpcaoGrupoId(null);
      await carregarComposicoes(compItem.id);
      if (alvo.id !== estoqueOpcao.id) {
        Alert.alert(
          'Desmembramento automático',
          `"${estoqueOpcao.name}" foi vinculado na unidade fracional "${alvo.unit}". O desmembramento do estoque será feito automaticamente na venda.`
        );
      }
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao adicionar opção');
    }
  };

  const estoqueFiltrado = estoque.filter(
    (p) =>
      p.name?.toLowerCase().includes(busca.toLowerCase()) ||
      p.id?.toString().includes(busca)
  );

  const itensEmFalta = estoque.filter((p) => estaEmFalta(p));

  const catalogoFiltrado = catalogo.filter((p) =>
    p.name?.toLowerCase().includes(entradaBusca.toLowerCase())
  );

  const opcoesEstoqueFiltradas = estoque.filter(
    (p) =>
      compItem &&
      p.id !== compItem.id &&
      p.name?.toLowerCase().includes(opcaoBusca.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
        <Appbar.Content title="Estoque" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <View style={styles.content}>
        <Searchbar
          placeholder="Buscar produto"
          onChangeText={setBusca}
          value={busca}
          style={styles.searchBar}
          iconColor="#fff"
          placeholderTextColor="#888"
          theme={{ colors: { text: '#fff' } }}
        />

        <ScrollView style={styles.lista}>
          {loading && estoque.length === 0 ? (
            <ActivityIndicator style={{ marginTop: 24 }} color="#2196F3" />
          ) : (
            <>
              {itensEmFalta.length > 0 && (
                <Card style={styles.faltaCard}>
                  <Card.Content>
                    <View style={styles.faltaHeader}>
                      <Text style={styles.faltaTitulo}>⚠️ Falta no Estoque</Text>
                      <Chip style={styles.faltaBadge} textStyle={{ color: '#fff' }}>
                        {itensEmFalta.length}
                      </Chip>
                    </View>
                    {itensEmFalta.map((item) => (
                      <View key={`falta-${item.id}`} style={styles.faltaItem}>
                        <Text style={styles.faltaItemNome}>{item.name}</Text>
                        <Text style={styles.faltaItemQtd}>
                          {item.quantity} {item.unit}
                          {minimoMap[item.id] != null ? ` / ideal ${minimoMap[item.id]}` : ''}
                        </Text>
                      </View>
                    ))}
                  </Card.Content>
                </Card>
              )}

              {estoqueFiltrado.length === 0 ? (
                <Text style={styles.semDados}>Nenhum item no estoque</Text>
              ) : (
                estoqueFiltrado.map((produto) => {
                  const emFalta = estaEmFalta(produto);
                  const min = minimoMap[produto.id];
                  return (
                    <Card key={produto.id} style={styles.produtoCard}>
                      <Card.Content>
                        <View style={styles.produtoHeader}>
                          <View style={styles.produtoInfo}>
                            <Text style={styles.produtoNome}>{produto.name}</Text>
                            {produto.category && (
                              <Text style={styles.produtoCategoria}>
                                {produto.category.name}
                              </Text>
                            )}
                          </View>
                          <Chip
                            mode="outlined"
                            icon="package-variant"
                            style={[styles.estoqueChip, emFalta ? styles.estoqueBaixo : {}]}
                            textStyle={{ color: emFalta ? '#FF5722' : '#2196F3' }}
                          >
                            {produto.quantity} {produto.unit}
                          </Chip>
                        </View>

                        {min != null && (
                          <Text style={styles.idealTexto}>Quantidade ideal: {min}</Text>
                        )}

                        <Divider style={styles.divider} />

                        <View style={styles.acoesRow}>
                          <Button
                            compact
                            mode="text"
                            icon="target"
                            textColor="#2196F3"
                            onPress={() => abrirMinimo(produto)}
                          >
                            Ideal
                          </Button>
                          <Button
                            compact
                            mode="text"
                            icon="swap-horizontal"
                            textColor="#4CAF50"
                            onPress={() => abrirConversao(produto)}
                          >
                            Conversão
                          </Button>
                          <Button
                            compact
                            mode="text"
                            icon="puzzle"
                            textColor="#FF9800"
                            onPress={() => abrirComponente(produto)}
                          >
                            Componente
                          </Button>
                          <Button
                            compact
                            mode="text"
                            icon="pencil"
                            textColor="#90caf9"
                            onPress={() => abrirEdicao(produto)}
                          >
                            Editar
                          </Button>
                          <Button
                            compact
                            mode="text"
                            icon="delete"
                            textColor="#F44336"
                            onPress={() => abrirExclusao(produto)}
                          >
                            Excluir
                          </Button>
                        </View>
                      </Card.Content>
                    </Card>
                  );
                })
              )}
            </>
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      </View>

      <FAB
        style={styles.fab}
        icon="plus"
        label="Entrada"
        onPress={abrirEntrada}
      />

      <Portal>
        {/* ===== Modal: Entrada de estoque (sem preço) ===== */}
        <Modal
          visible={entradaVisible}
          onDismiss={() => setEntradaVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>Dar Entrada no Estoque</Text>

            {entradaProduto ? (
              <Card style={styles.selecionadoCard}>
                <Card.Content style={styles.selecionadoContent}>
                  <Text style={styles.selecionadoNome}>{entradaProduto.name}</Text>
                  <IconButton
                    icon="close"
                    size={18}
                    iconColor="#FF5722"
                    onPress={() => setEntradaProduto(null)}
                  />
                </Card.Content>
              </Card>
            ) : (
              <Button
                mode="outlined"
                icon="magnify"
                textColor="#fff"
                style={styles.selecionarBtn}
                contentStyle={{ justifyContent: 'flex-start' }}
                onPress={() => {
                  setEntradaBusca('');
                  setEntradaPickerVisible(true);
                }}
              >
                Selecionar produto do catálogo
              </Button>
            )}

            <TextInput
              label="Quantidade *"
              value={entradaQuantidade}
              onChangeText={setEntradaQuantidade}
              mode="outlined"
              keyboardType="number-pad"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />

            <TextInput
              label="Unidade *"
              value={entradaUnidade}
              onChangeText={setEntradaUnidade}
              mode="outlined"
              placeholder="un, kg, l, fardo, caixa..."
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />

            <TextInput
              label="Valor de venda (R$)"
              value={entradaValor}
              onChangeText={setEntradaValor}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />

            <TextInput
              label="Valor de custo (R$)"
              value={entradaCusto}
              onChangeText={setEntradaCusto}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />

            <Text style={styles.dica}>
              Os valores vêm do cadastro do produto (por unidade, quando definido) e podem ser ajustados nesta entrada.
            </Text>

            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => setEntradaVisible(false)}
                style={styles.modalButton}
                textColor="#fff"
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={confirmarEntrada}
                loading={savingEntrada}
                disabled={savingEntrada}
                style={styles.modalButton}
              >
                Registrar
              </Button>
            </View>
          </ScrollView>
        </Modal>

        {/* ===== Modal: Seleção de produto (entrada) ===== */}
        <Modal
          visible={entradaPickerVisible}
          onDismiss={() => setEntradaPickerVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>Selecionar produto</Text>
          <TextInput
            label="Filtrar produto"
            value={entradaBusca}
            onChangeText={setEntradaBusca}
            mode="outlined"
            autoFocus
            left={<TextInput.Icon icon="magnify" />}
            style={styles.input}
            theme={{ colors: { background: '#2a2a2a' } }}
          />
          <ScrollView style={styles.pickerLista} keyboardShouldPersistTaps="handled">
            {catalogoFiltrado.map((p) => (
              <Button
                key={p.id}
                mode="text"
                textColor="#fff"
                style={styles.pickerItem}
                contentStyle={{ justifyContent: 'flex-start' }}
                onPress={() => {
                  setEntradaProduto(p);
                  setEntradaUnidade(p.unit || 'un');
                  setEntradaPickerVisible(false);
                }}
              >
                {p.name}
              </Button>
            ))}
            {catalogoFiltrado.length === 0 && (
              <Text style={styles.semDados}>Nenhum produto encontrado</Text>
            )}
          </ScrollView>
          <Button
            mode="outlined"
            onPress={() => setEntradaPickerVisible(false)}
            style={styles.modalButton}
            textColor="#fff"
          >
            Fechar
          </Button>
        </Modal>

        {/* ===== Modal: Quantidade ideal ===== */}
        <Modal
          visible={minimoVisible}
          onDismiss={() => setMinimoVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>Quantidade Ideal</Text>
            {minimoItem && (
              <Text style={styles.dica}>
                {minimoItem.name} — atual: {minimoItem.quantity} {minimoItem.unit}
              </Text>
            )}
            <TextInput
              label="Quantidade ideal (mínimo)"
              value={minimoValor}
              onChangeText={setMinimoValor}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />
            <Text style={styles.dica}>
              Ao ficar abaixo do ideal, o item entra na Lista de Compras. Deixe 0 ou vazio para remover.
            </Text>
            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => setMinimoVisible(false)}
                style={styles.modalButton}
                textColor="#fff"
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={salvarMinimo}
                loading={savingMinimo}
                disabled={savingMinimo}
                style={styles.modalButton}
              >
                Salvar
              </Button>
            </View>
          </ScrollView>
        </Modal>

        {/* ===== Modal: Conversão manual ===== */}
        <Modal
          visible={convVisible}
          onDismiss={() => setConvVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>Conversão Manual</Text>
            {convItem && (
              <Text style={styles.dica}>
                {convItem.name} — {convItem.quantity} {convItem.unit}
              </Text>
            )}
            <SegmentedButtons
              value={convModo}
              onValueChange={setConvModo}
              style={{ marginBottom: 12 }}
              buttons={[
                { value: 'base', label: 'Desmembrar' },
                { value: 'empacotar', label: 'Empacotar' },
                { value: 'dose', label: 'Porção' },
              ]}
            />
            <TextInput
              label={
                convModo === 'empacotar'
                  ? 'Qtd. de pacotes'
                  : convModo === 'base'
                  ? 'Qtd. a desmembrar'
                  : 'Qtd. de unidades a converter'
              }
              value={convQuantidade}
              onChangeText={setConvQuantidade}
              mode="outlined"
              keyboardType="number-pad"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />
            {convModo === 'empacotar' && (
              <TextInput
                label="Unidade de destino (fardo, caixa...)"
                value={convUnidadeAlvo}
                onChangeText={setConvUnidadeAlvo}
                mode="outlined"
                style={styles.input}
                theme={{ colors: { background: '#2a2a2a' } }}
              />
            )}
            {convModo === 'dose' && (
              <>
                <TextInput
                  label="Unidade de destino (Dose, Taça...)"
                  value={convDoseUnidade}
                  onChangeText={setConvDoseUnidade}
                  mode="outlined"
                  style={styles.input}
                  theme={{ colors: { background: '#2a2a2a' } }}
                />
                <TextInput
                  label="Rendimento por unidade (ex: 9)"
                  value={convDoseRendimento}
                  onChangeText={setConvDoseRendimento}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  style={styles.input}
                  theme={{ colors: { background: '#2a2a2a' } }}
                />
                <TextInput
                  label="Preço de venda da porção (opcional)"
                  value={convDoseValor}
                  onChangeText={setConvDoseValor}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  style={styles.input}
                  theme={{ colors: { background: '#2a2a2a' } }}
                />
              </>
            )}
            <Text style={styles.dica}>
              {convModo === 'base'
                ? 'Transforma pacotes/fardos em unidades base.'
                : convModo === 'empacotar'
                ? 'Agrupa unidades base em pacotes/fardos.'
                : 'Transforma 1 unidade em várias porções (ex: 1 Garrafa → 9 Doses).'}
            </Text>
            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => setConvVisible(false)}
                style={styles.modalButton}
                textColor="#fff"
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={confirmarConversao}
                loading={savingConv}
                disabled={savingConv}
                style={styles.modalButton}
              >
                Converter
              </Button>
            </View>
          </ScrollView>
        </Modal>

        {/* ===== Modal: Componente (composição) ===== */}
        <Modal
          visible={compVisible}
          onDismiss={() => setCompVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>Componentes</Text>
            {compItem && <Text style={styles.dica}>{compItem.name}</Text>}

            {loadingComp ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color="#2196F3" />
            ) : (
              composicoes.map((grupo) => (
                <Card key={grupo.id} style={styles.grupoCard}>
                  <Card.Content>
                    <View style={styles.grupoHeader}>
                      <Text style={styles.grupoNome}>
                        {grupo.nome} {grupo.obrigatorio ? '(obrigatório)' : ''}
                      </Text>
                      <IconButton
                        icon="delete"
                        size={18}
                        iconColor="#FF5722"
                        onPress={() => removerGrupoComponente(grupo.id)}
                      />
                    </View>
                    {(grupo.opcoes || []).map((op) => (
                      <Text key={op.id} style={styles.opcaoTexto}>
                        • {op.nome}
                        {op.valorExtra ? ` (+R$ ${formatarValor(op.valorExtra)})` : ''}
                      </Text>
                    ))}
                    <Button
                      compact
                      mode="text"
                      icon="plus"
                      textColor="#2196F3"
                      onPress={() =>
                        setOpcaoGrupoId(opcaoGrupoId === grupo.id ? null : grupo.id)
                      }
                    >
                      Adicionar opção
                    </Button>
                    {opcaoGrupoId === grupo.id && (
                      <View>
                        <TextInput
                          label="Buscar item do estoque"
                          value={opcaoBusca}
                          onChangeText={setOpcaoBusca}
                          mode="outlined"
                          dense
                          style={styles.input}
                          theme={{ colors: { background: '#2a2a2a' } }}
                        />
                        <View style={styles.pickerLista}>
                          {opcoesEstoqueFiltradas.slice(0, 15).map((e) => (
                            <Button
                              key={e.id}
                              mode="text"
                              textColor="#fff"
                              style={styles.pickerItem}
                              contentStyle={{ justifyContent: 'flex-start' }}
                              onPress={() => adicionarOpcaoComponente(grupo.id, e)}
                            >
                              {e.name}
                            </Button>
                          ))}
                        </View>
                      </View>
                    )}
                  </Card.Content>
                </Card>
              ))
            )}

            <Divider style={styles.divider} />
            <Text style={styles.subTitulo}>Novo componente</Text>
            <TextInput
              label="Nome do componente"
              value={novaCompNome}
              onChangeText={setNovaCompNome}
              mode="outlined"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />
            <Chip
              selected={novaCompObrigatorio}
              onPress={() => setNovaCompObrigatorio(!novaCompObrigatorio)}
              style={{ marginBottom: 12, alignSelf: 'flex-start' }}
            >
              Obrigatório
            </Chip>
            <Button
              mode="contained-tonal"
              icon="plus"
              onPress={adicionarGrupoComponente}
              loading={savingComp}
              disabled={savingComp}
              style={{ marginBottom: 12 }}
            >
              Adicionar componente
            </Button>

            <Button
              mode="outlined"
              onPress={() => setCompVisible(false)}
              textColor="#fff"
            >
              Fechar
            </Button>
          </ScrollView>
        </Modal>

        {/* ===== Modal: Editar item ===== */}
        <Modal
          visible={editVisible}
          onDismiss={() => setEditVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>Editar Item</Text>
            <TextInput
              label="Nome"
              value={editForm.name}
              onChangeText={(t) => setEditForm({ ...editForm, name: t })}
              mode="outlined"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />
            <TextInput
              label="Quantidade"
              value={editForm.quantity}
              onChangeText={(t) => setEditForm({ ...editForm, quantity: t })}
              mode="outlined"
              keyboardType="number-pad"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />
            <TextInput
              label="Unidade"
              value={editForm.unit}
              onChangeText={(t) => setEditForm({ ...editForm, unit: t })}
              mode="outlined"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />
            <TextInput
              label="Preço de venda"
              value={editForm.value}
              onChangeText={(t) => setEditForm({ ...editForm, value: t })}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />
            <TextInput
              label="Preço de custo"
              value={editForm.valuecusto}
              onChangeText={(t) => setEditForm({ ...editForm, valuecusto: t })}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />
            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => setEditVisible(false)}
                style={styles.modalButton}
                textColor="#fff"
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                onPress={salvarEdicao}
                loading={savingEdit}
                disabled={savingEdit}
                style={styles.modalButton}
              >
                Salvar
              </Button>
            </View>
          </ScrollView>
        </Modal>

        {/* ===== Modal: Excluir item (senha) ===== */}
        <Modal
          visible={deleteVisible}
          onDismiss={() => setDeleteVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text style={styles.modalTitle}>Excluir Item</Text>
            {deleteItem && (
              <Text style={styles.dica}>
                Confirme sua senha para excluir "{deleteItem.name}". Esta ação não pode ser desfeita.
              </Text>
            )}
            <TextInput
              label="Sua senha"
              value={deletePassword}
              onChangeText={setDeletePassword}
              mode="outlined"
              secureTextEntry
              style={styles.input}
              theme={{ colors: { background: '#2a2a2a' } }}
            />
            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => setDeleteVisible(false)}
                style={styles.modalButton}
                textColor="#fff"
              >
                Cancelar
              </Button>
              <Button
                mode="contained"
                buttonColor="#F44336"
                onPress={confirmarExclusao}
                loading={deleteLoading}
                disabled={deleteLoading}
                style={styles.modalButton}
              >
                Excluir
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
  },
  searchBar: {
    margin: 16,
    backgroundColor: '#1a1a1a',
  },
  lista: {
    flex: 1,
    paddingHorizontal: 16,
  },
  semDados: {
    textAlign: 'center',
    marginTop: 20,
    color: '#aaa',
  },
  produtoCard: {
    marginBottom: 12,
    backgroundColor: '#1a1a1a',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  produtoCategoria: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 4,
  },
  produtoPrecos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  precoItem: {
    flex: 1,
  },
  precoLabel: {
    fontSize: 10,
    color: '#aaa',
    marginBottom: 2,
  },
  precoCusto: {
    fontSize: 14,
    color: '#FF9800',
    fontWeight: 'bold',
  },
  precoVenda: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  precoLucro: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  produtoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  estoqueChip: {
    backgroundColor: 'transparent',
    borderColor: '#2196F3',
  },
  estoqueBaixo: {
    borderColor: '#FF5722',
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#fff',
  },
  input: {
    marginBottom: 12,
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
  deleteButton: {
    borderColor: '#FF5722',
  },
  faltaCard: {
    marginBottom: 16,
    backgroundColor: '#2a1414',
    borderColor: '#FF5722',
    borderWidth: 1,
  },
  faltaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  faltaTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF7043',
  },
  faltaBadge: {
    backgroundColor: '#FF5722',
  },
  faltaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#3a2020',
  },
  faltaItemNome: {
    color: '#fff',
    flex: 1,
  },
  faltaItemQtd: {
    color: '#FF9800',
    fontWeight: 'bold',
  },
  idealTexto: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 4,
  },
  divider: {
    marginVertical: 10,
    backgroundColor: '#333',
  },
  acoesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  selecionadoCard: {
    backgroundColor: '#14261a',
    marginBottom: 12,
  },
  selecionadoContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selecionadoNome: {
    color: '#fff',
    fontWeight: 'bold',
    flex: 1,
  },
  selecionarBtn: {
    marginBottom: 12,
    borderColor: '#555',
  },
  pickerLista: {
    marginBottom: 12,
    maxHeight: 300,
  },
  pickerItem: {
    alignItems: 'flex-start',
  },
  dica: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 12,
  },
  subTitulo: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  grupoCard: {
    backgroundColor: '#222',
    marginBottom: 10,
  },
  grupoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grupoNome: {
    color: '#fff',
    fontWeight: 'bold',
    flex: 1,
  },
  opcaoTexto: {
    color: '#ccc',
    fontSize: 13,
    marginVertical: 2,
  },
});
