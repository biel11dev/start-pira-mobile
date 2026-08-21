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
  IconButton,
  Divider,
} from 'react-native-paper';
import api from '../services/api';
import { formatarValor } from '../utils/format';

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
  const [precoCusto, setPrecoCusto] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [unitProduto, setUnitProduto] = useState('Unidade');
  const [baseUnitProduto, setBaseUnitProduto] = useState(null);

  // Categorias
  const [categorias, setCategorias] = useState([]);

  // Configuração de PDV do produto selecionado
  const [baseUnitEdit, setBaseUnitEdit] = useState(null);
  const [hiddenUnitsEdit, setHiddenUnitsEdit] = useState([]);
  const [unitPricesEdit, setUnitPricesEdit] = useState({});
  const [unitPricesModalVisible, setUnitPricesModalVisible] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Edição do produto (no modal de detalhes)
  const [editNome, setEditNome] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editValueCusto, setEditValueCusto] = useState('');
  const [editCategoryId, setEditCategoryId] = useState(null);
  const [deletingProduto, setDeletingProduto] = useState(false);

  // Gerenciar Categorias
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [novaCatParentId, setNovaCatParentId] = useState(null);
  const [savingCat, setSavingCat] = useState(false);

  // Gerenciar Unidades (equivalências)
  const [unidModalVisible, setUnidModalVisible] = useState(false);
  const [unidades, setUnidades] = useState([]);
  const [unitNome, setUnitNome] = useState('');
  const [unitTipo, setUnitTipo] = useState('empacotada'); // 'empacotada' | 'porcao'
  const [unitValor, setUnitValor] = useState('');
  const [unitFracionado, setUnitFracionado] = useState('');
  const [unitEditando, setUnitEditando] = useState(null);
  const [savingUnit, setSavingUnit] = useState(false);

  useEffect(() => {
    carregarProdutos();
    carregarCategorias();
    carregarUnidades();
  }, []);

  const carregarProdutos = async () => {
    try {
      const response = await api.get('/api/products');
      setProdutos(response.data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar produtos:', error);
    }
  };

  const carregarCategorias = async () => {
    try {
      const response = await api.get('/api/categories');
      setCategorias(response.data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar categorias:', error);
    }
  };

  // Achata categorias (pai + subcategorias) para seleção
  const categoriasFlat = () => {
    const out = [];
    categorias.forEach((c) => {
      out.push({ id: c.id, name: c.name });
      (c.subcategories || []).forEach((s) =>
        out.push({ id: s.id, name: `${c.name} > ${s.name}` })
      );
    });
    return out;
  };

  // Opções de unidade de medida (sempre inclui "Unidade" + equivalências cadastradas)
  const unidadesOpcoes = () => {
    const nomes = ['Unidade', ...(unidades || []).map((u) => u.unitName)];
    return [...new Set(nomes.filter(Boolean))];
  };

  const adicionarProduto = async () => {
    if (!nomeProduto || !preco || !precoCusto) {
      Alert.alert('Atenção', 'Preencha nome, preço de venda e preço de custo');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/products', {
        name: nomeProduto,
        unit: unitProduto || 'Unidade',
        value: parseFloat(preco),
        valuecusto: parseFloat(precoCusto),
        categoryId: selectedCategoryId,
        baseUnit: baseUnitProduto || null,
      });

      Alert.alert('Sucesso', 'Produto cadastrado!');
      setModalVisible(false);
      limparForm();
      carregarProdutos();
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao cadastrar produto');
    } finally {
      setLoading(false);
    }
  };

  const verDetalhes = (produto) => {
    setProdutoSelecionado(produto);
    setBaseUnitEdit(produto.baseUnit || null);
    setHiddenUnitsEdit(Array.isArray(produto.pdvHiddenUnits) ? produto.pdvHiddenUnits : []);
    setUnitPricesEdit(produto.unitPrices && typeof produto.unitPrices === 'object' ? produto.unitPrices : {});
    setEditNome(produto.name || '');
    setEditValue(produto.value != null ? String(produto.value) : '');
    setEditValueCusto(produto.valuecusto != null ? String(produto.valuecusto) : '');
    setEditCategoryId(produto.categoryId ?? produto.category?.id ?? null);
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

  // Atualiza (em string, para edição) o valor de venda/custo de uma unidade
  const atualizarUnitPrice = (unit, field, val) => {
    setUnitPricesEdit((prev) => {
      const up = { ...(prev || {}) };
      const entry = { ...(up[unit] || {}) };
      if (val === '' || val == null) delete entry[field];
      else entry[field] = val;
      if (Object.keys(entry).length === 0) delete up[unit];
      else up[unit] = entry;
      return up;
    });
  };

  // Converte os valores digitados (string, com vírgula ou ponto) para números ao salvar
  const normalizarUnitPrices = (obj) => {
    const out = {};
    Object.entries(obj || {}).forEach(([unit, cfg]) => {
      const entry = {};
      ['value', 'cost'].forEach((field) => {
        const raw = cfg?.[field];
        if (raw !== undefined && raw !== null && String(raw) !== '') {
          const n = parseFloat(String(raw).replace(',', '.'));
          if (!isNaN(n)) entry[field] = n;
        }
      });
      if (Object.keys(entry).length) out[unit] = entry;
    });
    return out;
  };

  const salvarConfigPdv = async () => {
    if (!produtoSelecionado) return;
    if (!editNome.trim()) {
      Alert.alert('Atenção', 'Informe o nome do produto.');
      return;
    }
    setSavingConfig(true);
    try {
      await api.put(`/api/products/${produtoSelecionado.id}`, {
        name: editNome.trim(),
        quantity: produtoSelecionado.quantity ?? 0,
        unit: produtoSelecionado.unit,
        value: parseFloat(editValue) || 0,
        valuecusto: parseFloat(editValueCusto) || 0,
        categoryId: editCategoryId || null,
        baseUnit: baseUnitEdit || null,
        pdvHiddenUnits: hiddenUnitsEdit,
        unitPrices: normalizarUnitPrices(unitPricesEdit),
      });
      Alert.alert('Sucesso', 'Produto atualizado!');
      setModalDetalhes(false);
      carregarProdutos();
    } catch (error) {
      const msg = error.response?.data?.error || 'Erro ao salvar produto';
      Alert.alert('Erro', msg);
    } finally {
      setSavingConfig(false);
    }
  };

  const excluirProduto = () => {
    if (!produtoSelecionado) return;
    Alert.alert(
      'Confirmar Exclusão',
      `Deseja realmente excluir o produto "${produtoSelecionado.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setDeletingProduto(true);
            try {
              await api.delete(`/api/products/${produtoSelecionado.id}`);
              setModalDetalhes(false);
              carregarProdutos();
            } catch (error) {
              Alert.alert('Erro', error.response?.data?.error || 'Erro ao excluir produto');
            } finally {
              setDeletingProduto(false);
            }
          },
        },
      ]
    );
  };

  const limparForm = () => {
    setNomeProduto('');
    setPreco('');
    setPrecoCusto('');
    setSelectedCategoryId(null);
    setUnitProduto('Unidade');
    setBaseUnitProduto(null);
  };

  // ===================== Categorias =====================
  const adicionarCategoria = async () => {
    if (!novaCategoria.trim()) {
      Alert.alert('Atenção', 'Digite o nome da categoria');
      return;
    }
    setSavingCat(true);
    try {
      await api.post('/api/categories', {
        name: novaCategoria.trim(),
        parentId: novaCatParentId || null,
      });
      setNovaCategoria('');
      setNovaCatParentId(null);
      await carregarCategorias();
      Alert.alert('Sucesso', 'Categoria adicionada!');
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.error || 'Erro ao adicionar categoria');
    } finally {
      setSavingCat(false);
    }
  };

  const excluirCategoria = (cat) => {
    Alert.alert('Confirmar Exclusão', `Excluir a categoria "${cat.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/categories/${cat.id}`);
            await carregarCategorias();
          } catch (error) {
            Alert.alert('Erro', error.response?.data?.error || 'Erro ao excluir categoria');
          }
        },
      },
    ]);
  };

  // ===================== Unidades (equivalências) =====================
  const carregarUnidades = async () => {
    try {
      const res = await api.get('/api/unit-equivalences');
      setUnidades(res.data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar unidades:', error);
    }
  };

  const abrirUnidades = () => {
    limparUnitForm();
    carregarUnidades();
    setUnidModalVisible(true);
  };

  const limparUnitForm = () => {
    setUnitEditando(null);
    setUnitNome('');
    setUnitTipo('empacotada');
    setUnitValor('');
    setUnitFracionado('');
  };

  const editarUnidade = (u) => {
    setUnitEditando(u.unitName);
    if (u.isFractional) {
      setUnitTipo('porcao');
      setUnitFracionado(u.fractionalValue != null ? String(u.fractionalValue) : '');
      setUnitValor('');
    } else {
      setUnitTipo('empacotada');
      setUnitValor(u.value != null ? String(u.value) : '');
      setUnitFracionado('');
    }
  };

  const salvarUnidade = async () => {
    const nome = (unitEditando || unitNome).trim();
    if (!nome) {
      Alert.alert('Atenção', 'Digite o nome da unidade');
      return;
    }
    const isPorcao = unitTipo === 'porcao';
    const valorNum = parseFloat(unitValor);
    const fracNum = parseFloat(unitFracionado);
    if (!isPorcao && (unitValor.trim() === '' || isNaN(valorNum) || valorNum <= 0)) {
      Alert.alert('Atenção', 'Digite um número válido maior que zero!');
      return;
    }
    if (isPorcao && (unitFracionado.trim() === '' || isNaN(fracNum) || fracNum <= 0)) {
      Alert.alert('Atenção', 'Informe um valor maior que zero para a equivalência (ex: 0,5 para meia unidade ou 9 para 1 Garrafa → 9 Doses)!');
      return;
    }
    const payload = isPorcao
      ? { isFractional: true, fractionalValue: fracNum }
      : { value: valorNum, isFractional: false };
    setSavingUnit(true);
    try {
      if (unitEditando) {
        await api.put(`/api/unit-equivalences/${encodeURIComponent(unitEditando)}`, payload);
      } else {
        await api.post('/api/unit-equivalences', { unitName: nome, ...payload });
      }
      limparUnitForm();
      await carregarUnidades();
      Alert.alert('Sucesso', `Equivalência ${unitEditando ? 'atualizada' : 'definida'}!`);
    } catch (error) {
      const msg =
        error.response?.status === 409
          ? 'Esta unidade já possui equivalência definida!'
          : error.response?.data?.error || 'Erro ao salvar equivalência';
      Alert.alert('Erro', msg);
    } finally {
      setSavingUnit(false);
    }
  };

  const excluirUnidade = (unitName) => {
    Alert.alert('Confirmar Exclusão', `Excluir a unidade "${unitName}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/unit-equivalences/${encodeURIComponent(unitName)}`);
            if (unitEditando === unitName) limparUnitForm();
            await carregarUnidades();
          } catch (error) {
            Alert.alert('Erro', error.response?.data?.error || 'Erro ao excluir unidade');
          }
        },
      },
    ]);
  };

  const produtosFiltrados = produtos.filter(    (p) =>
      p.name?.toLowerCase().includes(busca.toLowerCase()) ||
      p.id?.toString().includes(busca)
  );

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Produtos" />
        <Appbar.Action icon="tag-multiple" onPress={() => setCatModalVisible(true)} />
        <Appbar.Action icon="scale-balance" onPress={abrirUnidades} />
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
                        R$ {formatarValor(produto.value)}
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
              label="Preço de Venda *"
              value={preco}
              onChangeText={setPreco}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <TextInput
              label="Preço de Custo *"
              value={precoCusto}
              onChangeText={setPrecoCusto}
              mode="outlined"
              keyboardType="decimal-pad"
              style={styles.input}
            />

            <Text style={styles.configLabel}>Unidade de Medida:</Text>
            <View style={styles.configChips}>
              {unidadesOpcoes().map((u) => (
                <Chip
                  key={u}
                  selected={unitProduto === u}
                  onPress={() => setUnitProduto(u)}
                  style={styles.configChip}
                >
                  {u}
                </Chip>
              ))}
            </View>

            <Text style={styles.configLabel}>Unidade base (conversão):</Text>
            <View style={styles.configChips}>
              <Chip
                selected={!baseUnitProduto}
                onPress={() => setBaseUnitProduto(null)}
                style={styles.configChip}
              >
                Automática
              </Chip>
              {unidadesOpcoes().map((u) => (
                <Chip
                  key={u}
                  selected={baseUnitProduto === u}
                  onPress={() => setBaseUnitProduto(u)}
                  style={styles.configChip}
                >
                  {u}
                </Chip>
              ))}
            </View>

            <Text style={styles.configLabel}>Categoria:</Text>
            <View style={styles.configChips}>
              <Chip
                selected={!selectedCategoryId}
                onPress={() => setSelectedCategoryId(null)}
                style={styles.configChip}
              >
                Sem categoria
              </Chip>
              {categoriasFlat().map((c) => (
                <Chip
                  key={c.id}
                  selected={selectedCategoryId === c.id}
                  onPress={() => setSelectedCategoryId(c.id)}
                  style={styles.configChip}
                >
                  {c.name}
                </Chip>
              ))}
            </View>

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

              <ScrollView>
                <Text style={styles.configTitulo}>Dados do Produto</Text>
                <TextInput
                  label="Nome"
                  value={editNome}
                  onChangeText={setEditNome}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label="Preço de Venda"
                  value={editValue}
                  onChangeText={setEditValue}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
                <TextInput
                  label="Preço de Custo"
                  value={editValueCusto}
                  onChangeText={setEditValueCusto}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  style={styles.input}
                />

                <Text style={styles.configLabel}>Categoria:</Text>
                <View style={styles.configChips}>
                  <Chip
                    selected={!editCategoryId}
                    onPress={() => setEditCategoryId(null)}
                    style={styles.configChip}
                  >
                    Sem categoria
                  </Chip>
                  {categoriasFlat().map((c) => (
                    <Chip
                      key={c.id}
                      selected={editCategoryId === c.id}
                      onPress={() => setEditCategoryId(c.id)}
                      style={styles.configChip}
                    >
                      {c.name}
                    </Chip>
                  ))}
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

                <Text style={styles.configLabel}>Valores por unidade:</Text>
                {unidadesDoProduto(produtoSelecionado).length === 0 ? (
                  <Text style={styles.configVazio}>Dê entrada no estoque para definir valores por unidade.</Text>
                ) : (
                  <Button
                    mode="outlined"
                    icon="currency-usd"
                    onPress={() => setUnitPricesModalVisible(true)}
                    style={styles.configChip}
                  >
                    Venda/custo por unidade
                  </Button>
                )}

                <Button
                  mode="contained"
                  icon="content-save"
                  onPress={salvarConfigPdv}
                  loading={savingConfig}
                  disabled={savingConfig}
                  style={styles.salvarConfigButton}
                >
                  Salvar produto
                </Button>
              </View>

              <Button
                mode="contained"
                icon="delete"
                buttonColor="#F44336"
                onPress={excluirProduto}
                loading={deletingProduto}
                disabled={deletingProduto}
                style={styles.fecharButton}
              >
                Excluir produto
              </Button>
              </ScrollView>

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

        {/* Modal Gerenciar Categorias */}
        <Modal
          visible={catModalVisible}
          onDismiss={() => setCatModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>Gerenciar Categorias</Text>
          <ScrollView style={styles.crudScroll}>
            <TextInput
              label="Nova categoria"
              value={novaCategoria}
              onChangeText={setNovaCategoria}
              mode="outlined"
              style={styles.input}
            />
            <Text style={styles.configLabel}>Categoria pai (opcional):</Text>
            <View style={styles.configChips}>
              <Chip
                selected={!novaCatParentId}
                onPress={() => setNovaCatParentId(null)}
                style={styles.configChip}
              >
                Principal
              </Chip>
              {categorias.map((c) => (
                <Chip
                  key={c.id}
                  selected={novaCatParentId === c.id}
                  onPress={() => setNovaCatParentId(c.id)}
                  style={styles.configChip}
                >
                  {c.name}
                </Chip>
              ))}
            </View>
            <Button
              mode="contained"
              icon="plus"
              onPress={adicionarCategoria}
              loading={savingCat}
              disabled={savingCat}
              style={styles.salvarConfigButton}
            >
              Adicionar categoria
            </Button>

            <Divider style={styles.crudDivider} />
            <Text style={styles.configTitulo}>Categorias existentes</Text>
            {categorias.length === 0 && (
              <Text style={styles.configVazio}>Nenhuma categoria cadastrada.</Text>
            )}
            {categorias.map((c) => (
              <View key={c.id}>
                <View style={styles.crudRow}>
                  <Text style={styles.crudNome}>{c.name}</Text>
                  <IconButton
                    icon="delete"
                    size={20}
                    iconColor="#F44336"
                    onPress={() => excluirCategoria(c)}
                  />
                </View>
                {(c.subcategories || []).map((s) => (
                  <View key={s.id} style={[styles.crudRow, styles.crudSubRow]}>
                    <Text style={styles.crudSubNome}>› {s.name}</Text>
                    <IconButton
                      icon="delete"
                      size={20}
                      iconColor="#F44336"
                      onPress={() => excluirCategoria(s)}
                    />
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
          <Button
            mode="outlined"
            onPress={() => setCatModalVisible(false)}
            style={styles.fecharButton}
          >
            Fechar
          </Button>
        </Modal>

        {/* Modal Gerenciar Unidades */}
        <Modal
          visible={unidModalVisible}
          onDismiss={() => setUnidModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>Gerenciar Unidades</Text>
          <ScrollView style={styles.crudScroll}>
            {!unitEditando && (
              <TextInput
                label="Nome da unidade"
                value={unitNome}
                onChangeText={setUnitNome}
                mode="outlined"
                style={styles.input}
              />
            )}
            {unitEditando && (
              <Text style={styles.editandoLabel}>Editando: {unitEditando}</Text>
            )}

            <Text style={styles.configLabel}>Tipo:</Text>
            <View style={styles.configChips}>
              <Chip
                selected={unitTipo === 'empacotada'}
                onPress={() => setUnitTipo('empacotada')}
                style={styles.configChip}
              >
                Empacotada
              </Chip>
              <Chip
                selected={unitTipo === 'porcao'}
                onPress={() => setUnitTipo('porcao')}
                style={styles.configChip}
              >
                Porção/Fracionada
              </Chip>
            </View>

            {unitTipo === 'empacotada' ? (
              <TextInput
                label="Quantas unidades = 1 (ex: 12)"
                value={unitValor}
                onChangeText={setUnitValor}
                mode="outlined"
                keyboardType="decimal-pad"
                style={styles.input}
              />
            ) : (
              <>
                <TextInput
                  label="Porções por unidade-pai (ex: 9)"
                  value={unitFracionado}
                  onChangeText={setUnitFracionado}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
                {unitFracionado !== '' && parseFloat(unitFracionado) > 0 && (
                  <Text style={styles.unitHint}>
                    1 unidade-pai → {unitFracionado} {(unitEditando || unitNome) || 'un'}(s)
                  </Text>
                )}
              </>
            )}

            <View style={styles.modalButtons}>
              {unitEditando && (
                <Button
                  mode="outlined"
                  onPress={limparUnitForm}
                  style={styles.modalButton}
                >
                  Cancelar edição
                </Button>
              )}
              <Button
                mode="contained"
                icon="content-save"
                onPress={salvarUnidade}
                loading={savingUnit}
                disabled={savingUnit}
                style={styles.modalButton}
              >
                {unitEditando ? 'Salvar' : 'Adicionar'}
              </Button>
            </View>

            <Divider style={styles.crudDivider} />
            <Text style={styles.configTitulo}>Unidades existentes</Text>
            {unidades.length === 0 && (
              <Text style={styles.configVazio}>Nenhuma unidade cadastrada.</Text>
            )}
            {unidades.map((u) => (
              <View key={u.unitName} style={styles.crudRow}>
                <View style={styles.crudUnitInfo}>
                  <Text style={styles.crudNome}>{u.unitName}</Text>
                  <Text style={styles.crudUnitSub}>
                    {u.isFractional
                      ? `1 pai → ${u.fractionalValue} porções`
                      : `1 ${u.unitName} = ${u.value} un`}
                  </Text>
                </View>
                <IconButton
                  icon="pencil"
                  size={20}
                  iconColor="#2196F3"
                  onPress={() => editarUnidade(u)}
                />
                <IconButton
                  icon="delete"
                  size={20}
                  iconColor="#F44336"
                  onPress={() => excluirUnidade(u.unitName)}
                />
              </View>
            ))}
          </ScrollView>
          <Button
            mode="outlined"
            onPress={() => setUnidModalVisible(false)}
            style={styles.fecharButton}
          >
            Fechar
          </Button>
        </Modal>

        {/* Modal: valores de venda/custo por unidade */}
        <Modal
          visible={unitPricesModalVisible}
          onDismiss={() => setUnitPricesModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>Valores por unidade</Text>
          <Text style={styles.configVazio}>
            Defina o valor de venda e de custo de cada unidade. Serão sugeridos na entrada de estoque.
          </Text>
          <ScrollView style={{ maxHeight: 380 }}>
            {unidadesDoProduto(produtoSelecionado).map((u) => {
              const cfg = (unitPricesEdit || {})[u] || {};
              return (
                <View key={u} style={styles.unitPriceRow}>
                  <Text style={styles.unitPriceNome}>{u}</Text>
                  <View style={styles.unitPriceInputs}>
                    <TextInput
                      label="Venda (R$)"
                      mode="outlined"
                      dense
                      keyboardType="decimal-pad"
                      value={cfg.value != null ? String(cfg.value) : ''}
                      onChangeText={(t) => atualizarUnitPrice(u, 'value', t)}
                      style={styles.unitPriceInput}
                    />
                    <TextInput
                      label="Custo (R$)"
                      mode="outlined"
                      dense
                      keyboardType="decimal-pad"
                      value={cfg.cost != null ? String(cfg.cost) : ''}
                      onChangeText={(t) => atualizarUnitPrice(u, 'cost', t)}
                      style={styles.unitPriceInput}
                    />
                  </View>
                </View>
              );
            })}
            {unidadesDoProduto(produtoSelecionado).length === 0 && (
              <Text style={styles.configVazio}>Nenhuma unidade em estoque.</Text>
            )}
          </ScrollView>
          <Button
            mode="contained"
            icon="check"
            onPress={() => setUnitPricesModalVisible(false)}
            style={styles.salvarConfigButton}
          >
            Concluir
          </Button>
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
  unitPriceRow: {
    marginBottom: 12,
  },
  unitPriceNome: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  unitPriceInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  unitPriceInput: {
    flex: 1,
    backgroundColor: '#fff',
  },
  crudScroll: {
    maxHeight: 420,
  },
  crudDivider: {
    marginVertical: 16,
  },
  crudRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  crudSubRow: {
    paddingLeft: 16,
  },
  crudNome: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  crudSubNome: {
    flex: 1,
    fontSize: 14,
    color: '#555',
  },
  crudUnitInfo: {
    flex: 1,
  },
  crudUnitSub: {
    fontSize: 12,
    color: '#888',
  },
  editandoLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 8,
  },
  unitHint: {
    fontSize: 12,
    color: '#4CAF50',
    marginBottom: 8,
  },
});
