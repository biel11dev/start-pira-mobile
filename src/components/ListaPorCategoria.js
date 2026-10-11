import React, { useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Chip, Icon } from 'react-native-paper';

const collator = (a, b) => a.localeCompare(b, 'pt-BR');

// Agrupa itens pela categoria. hierarquico: Categoria -> Subcategoria (Estoque);
// caso contrário um único nível "Categoria > Subcategoria" (Base de Cadastro).
export function agruparPorCategoria(itens, hierarquico = true) {
  const mapa = {};
  (itens || []).forEach((item) => {
    const cat = item.category;
    let pai = 'Sem Categoria';
    let sub = null;
    if (cat) {
      if (cat.parent) {
        pai = cat.parent.name;
        sub = cat.name;
      } else {
        pai = cat.name;
      }
    }
    const nomeGrupo = hierarquico ? pai : sub ? `${pai} > ${sub}` : pai;
    const subKey = hierarquico ? sub || '_direct' : '_all';
    if (!mapa[nomeGrupo]) mapa[nomeGrupo] = { nome: nomeGrupo, total: 0, subs: {} };
    if (!mapa[nomeGrupo].subs[subKey]) mapa[nomeGrupo].subs[subKey] = [];
    mapa[nomeGrupo].subs[subKey].push(item);
    mapa[nomeGrupo].total += 1;
  });

  return Object.values(mapa)
    .sort((a, b) => collator(a.nome, b.nome))
    .map((g) => ({
      ...g,
      subs: Object.entries(g.subs)
        .sort(([a], [b]) => collator(a === '_direct' ? '' : a, b === '_direct' ? '' : b))
        .map(([key, lista]) => ({
          key,
          nome: key === '_direct' ? 'Produtos diretos' : key,
          itens: [...lista].sort((a, b) => collator(a.name || '', b.name || '')),
        })),
    }));
}

export default function ListaPorCategoria({ itens, renderItem, hierarquico = true, expandirTudo = false }) {
  const [abertos, setAbertos] = useState({});
  const grupos = useMemo(() => agruparPorCategoria(itens, hierarquico), [itens, hierarquico]);

  const alternar = (chave) => setAbertos((prev) => ({ ...prev, [chave]: !prev[chave] }));
  const aberto = (chave) => expandirTudo || !!abertos[chave];
  const rotuloItens = (n) => `${n} ${n === 1 ? 'item' : 'itens'}`;

  const renderItens = (lista) =>
    lista.map((item) => <React.Fragment key={item.id}>{renderItem(item)}</React.Fragment>);

  return (
    <View>
      {grupos.map((grupo) => (
        <View key={grupo.nome} style={styles.grupo}>
          <TouchableOpacity
            style={styles.grupoHeader}
            activeOpacity={0.7}
            onPress={() => alternar(grupo.nome)}
          >
            <Text style={styles.grupoTitulo} numberOfLines={1}>
              📁 {grupo.nome}
            </Text>
            <Chip compact style={styles.contagem} textStyle={styles.contagemTexto}>
              {rotuloItens(grupo.total)}
            </Chip>
            <Icon source={aberto(grupo.nome) ? 'chevron-up' : 'chevron-down'} size={22} color="#fff" />
          </TouchableOpacity>

          {aberto(grupo.nome) &&
            grupo.subs.map((sub) => {
              if (!hierarquico) return <View key={sub.key}>{renderItens(sub.itens)}</View>;
              const chaveSub = `${grupo.nome}::${sub.key}`;
              return (
                <View key={sub.key} style={styles.sub}>
                  <TouchableOpacity
                    style={styles.subHeader}
                    activeOpacity={0.7}
                    onPress={() => alternar(chaveSub)}
                  >
                    <Text style={styles.subTitulo} numberOfLines={1}>
                      📄 {sub.nome}
                    </Text>
                    <Chip compact style={styles.contagem} textStyle={styles.contagemTexto}>
                      {rotuloItens(sub.itens.length)}
                    </Chip>
                    <Icon source={aberto(chaveSub) ? 'chevron-up' : 'chevron-down'} size={20} color="#ddd" />
                  </TouchableOpacity>
                  {aberto(chaveSub) && renderItens(sub.itens)}
                </View>
              );
            })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0d0d0d',
  },
  grupoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#1b1f3a',
    gap: 8,
  },
  grupoTitulo: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sub: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    backgroundColor: '#1f1f1f',
    borderRadius: 8,
    gap: 8,
  },
  subTitulo: {
    flex: 1,
    color: '#ddd',
    fontSize: 14,
  },
  contagem: {
    backgroundColor: '#3a3d55',
  },
  contagemTexto: {
    color: '#fff',
    fontSize: 11,
  },
});
